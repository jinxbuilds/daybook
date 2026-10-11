import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { Task, PRIORITIES, REPEATS } from "../models/Task.js";
import { validateBody, validateQuery } from "../middleware/validate.js";
import { HttpError, notFound } from "../lib/errors.js";
import { isValidDate, nextOccurrence } from "../lib/recurrence.js";

const dateSchema = z.string().refine(isValidDate, "must be a date in YYYY-MM-DD format");

const fields = {
  title: z.string().trim().min(1, "is required").max(200),
  notes: z.string().max(5000),
  dueDate: dateSchema.nullable(),
  priority: z.enum(PRIORITIES),
  project: z.string().trim().max(40),
  repeat: z.enum(REPEATS),
};

const createSchema = z
  .object({
    title: fields.title,
    notes: fields.notes.default(""),
    dueDate: fields.dueDate.default(null),
    priority: fields.priority.default("none"),
    project: fields.project.default(""),
    repeat: fields.repeat.default("none"),
  })
  .strict()
  .refine((t) => t.repeat === "none" || t.dueDate, { message: "repeating tasks need a due date", path: ["dueDate"] });

const updateSchema = z
  .object({ ...fields, completed: z.boolean() })
  .partial()
  .strict()
  .refine((o) => Object.keys(o).length > 0, "Nothing to update");

const listQuery = z.object({ status: z.enum(["open", "done", "all"]).default("all") });

// Every query below includes owner: req.user._id, so a user can only ever
// see or change their own tasks. Unknown or foreign IDs return 404.
function ownedFilter(req) {
  const { id } = req.params;
  if (!mongoose.isValidObjectId(id)) throw notFound("Task not found");
  return { _id: id, owner: req.user._id };
}

export function taskRoutes({ session }) {
  const router = Router();
  router.use(session.requireAuth);

  router.get("/", validateQuery(listQuery), async (req, res) => {
    const { status } = req.validQuery;
    const filter = { owner: req.user._id };
    if (status === "open") filter.completed = false;
    if (status === "done") filter.completed = true;
    // Open tasks are all returned; completed history is capped.
    const [open, done] = await Promise.all([
      status === "done" ? [] : Task.find({ ...filter, completed: false }).sort({ createdAt: -1 }).limit(2000),
      status === "open"
        ? []
        : Task.find({ ...filter, completed: true }).sort({ completedAt: -1 }).limit(300),
    ]);
    res.json({ tasks: [...open, ...done].map((t) => t.toPublic()) });
  });

  router.post("/", validateBody(createSchema), async (req, res) => {
    const count = await Task.countDocuments({ owner: req.user._id, completed: false });
    if (count >= 5000) throw new HttpError(400, "You've reached 5,000 open tasks. Complete or delete some first.");
    const task = await Task.create({ ...req.body, owner: req.user._id });
    res.status(201).json({ task: task.toPublic() });
  });

  router.patch("/:id", validateBody(updateSchema), async (req, res) => {
    const task = await Task.findOne(ownedFilter(req));
    if (!task) throw notFound("Task not found");

    const wasCompleted = task.completed;
    Object.assign(task, req.body);
    if (task.repeat !== "none" && !task.dueDate) {
      throw new HttpError(400, "dueDate: repeating tasks need a due date");
    }

    let next = null;
    if (req.body.completed === true && !wasCompleted) {
      task.completedAt = new Date();
      // Completing a repeating task schedules the next one.
      if (task.repeat !== "none") {
        const nextTask = await Task.create({
          owner: req.user._id,
          title: task.title,
          notes: task.notes,
          priority: task.priority,
          project: task.project,
          repeat: task.repeat,
          dueDate: nextOccurrence(task.dueDate, task.repeat),
        });
        task.repeat = "none"; // the finished copy stops repeating
        next = nextTask.toPublic();
      }
    } else if (req.body.completed === false) {
      task.completedAt = null;
    }

    await task.save();
    res.json({ task: task.toPublic(), next });
  });

  router.delete("/:id", async (req, res) => {
    const { deletedCount } = await Task.deleteOne(ownedFilter(req));
    if (!deletedCount) throw notFound("Task not found");
    res.json({ ok: true });
  });

  router.post("/clear-completed", async (req, res) => {
    const { deletedCount } = await Task.deleteMany({ owner: req.user._id, completed: true });
    res.json({ deleted: deletedCount });
  });

  return router;
}
