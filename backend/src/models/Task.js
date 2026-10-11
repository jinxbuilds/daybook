import mongoose from "mongoose";

export const PRIORITIES = ["none", "low", "medium", "high"];
export const REPEATS = ["none", "daily", "weekdays", "weekly", "monthly"];

const taskSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    notes: { type: String, default: "", maxlength: 5000 },
    // Calendar date as YYYY-MM-DD so a due date never shifts with time zones.
    dueDate: { type: String, default: null, match: /^\d{4}-\d{2}-\d{2}$/ },
    priority: { type: String, enum: PRIORITIES, default: "none" },
    project: { type: String, default: "", trim: true, maxlength: 40 },
    repeat: { type: String, enum: REPEATS, default: "none" },
    completed: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

taskSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    title: this.title,
    notes: this.notes,
    dueDate: this.dueDate,
    priority: this.priority,
    project: this.project,
    repeat: this.repeat,
    completed: this.completed,
    completedAt: this.completedAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

export const Task = mongoose.model("Task", taskSchema);
