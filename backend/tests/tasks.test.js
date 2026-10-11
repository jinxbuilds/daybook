import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { setup, teardown, signedUpClient } from "./helpers.js";

let app;
before(async () => ({ app } = await setup()));
after(teardown);

describe("task CRUD", () => {
  test("create, list, update, complete, delete", async () => {
    const c = await signedUpClient(app);
    const created = await c.post("/api/tasks").send({ title: "Buy milk", dueDate: "2026-10-12", priority: "high", project: "home" });
    assert.equal(created.status, 201);
    const id = created.body.task.id;

    const list = await c.get("/api/tasks");
    assert.equal(list.body.tasks.length, 1);

    const upd = await c.patch(`/api/tasks/${id}`).send({ notes: "2 litres", completed: true });
    assert.equal(upd.status, 200);
    assert.equal(upd.body.task.completed, true);
    assert.ok(upd.body.task.completedAt);

    const open = await c.get("/api/tasks?status=open");
    assert.equal(open.body.tasks.length, 0);

    await c.delete(`/api/tasks/${id}`).expect(200);
    await c.delete(`/api/tasks/${id}`).expect(404);
  });

  test("validation: bad dates, unknown fields and empty titles are rejected", async () => {
    const c = await signedUpClient(app);
    await c.post("/api/tasks").send({ title: "" }).expect(400);
    await c.post("/api/tasks").send({ title: "x", dueDate: "2026-02-30" }).expect(400);
    await c.post("/api/tasks").send({ title: "x", priority: "urgent" }).expect(400);
    await c.post("/api/tasks").send({ title: "x", repeat: "daily" }).expect(400); // needs a date
  });

  test("completing a repeating task schedules the next one", async () => {
    const c = await signedUpClient(app);
    const t = await c.post("/api/tasks").send({ title: "Stand-up", dueDate: "2026-10-09", repeat: "weekdays" });
    const res = await c.patch(`/api/tasks/${t.body.task.id}`).send({ completed: true });
    assert.equal(res.body.next.dueDate, "2026-10-12"); // Friday -> Monday
    assert.equal(res.body.next.repeat, "weekdays");
    assert.equal(res.body.task.repeat, "none");
  });

  test("clear completed only removes completed tasks", async () => {
    const c = await signedUpClient(app);
    const a = await c.post("/api/tasks").send({ title: "a" });
    await c.post("/api/tasks").send({ title: "b" });
    await c.patch(`/api/tasks/${a.body.task.id}`).send({ completed: true });
    const res = await c.post("/api/tasks/clear-completed");
    assert.equal(res.body.deleted, 1);
    assert.equal((await c.get("/api/tasks")).body.tasks.length, 1);
  });
});

describe("[SC-05] object-level authorization", () => {
  test("another user cannot read, update or delete my task", async () => {
    const alice = await signedUpClient(app);
    const bob = await signedUpClient(app);
    const t = await alice.post("/api/tasks").send({ title: "Alice's secret" });
    const id = t.body.task.id;

    const bobList = await bob.get("/api/tasks");
    assert.equal(bobList.body.tasks.length, 0);

    await bob.patch(`/api/tasks/${id}`).send({ title: "pwned" }).expect(404);
    await bob.patch(`/api/tasks/${id}`).send({ completed: true }).expect(404);
    await bob.delete(`/api/tasks/${id}`).expect(404);

    const still = await alice.get("/api/tasks");
    assert.equal(still.body.tasks[0].title, "Alice's secret");
    assert.equal(still.body.tasks[0].completed, false);
  });

  test("owner cannot be set or changed through the request body", async () => {
    const alice = await signedUpClient(app);
    const bob = await signedUpClient(app);
    await bob.post("/api/tasks").send({ title: "planted", owner: alice.user.id }).expect(400);
    const t = await bob.post("/api/tasks").send({ title: "mine" });
    await bob.patch(`/api/tasks/${t.body.task.id}`).send({ owner: alice.user.id }).expect(400);
    assert.equal((await alice.get("/api/tasks")).body.tasks.length, 0);
  });

  test("bob's clear-completed does not touch alice's tasks", async () => {
    const alice = await signedUpClient(app);
    const bob = await signedUpClient(app);
    const t = await alice.post("/api/tasks").send({ title: "done" });
    await alice.patch(`/api/tasks/${t.body.task.id}`).send({ completed: true });
    await bob.post("/api/tasks/clear-completed").expect(200);
    assert.equal((await alice.get("/api/tasks")).body.tasks.length, 1);
  });

  test("task routes require a session", async () => {
    await request(app).get("/api/tasks").expect(401);
  });

  test("malformed IDs return 404, not a server error", async () => {
    const c = await signedUpClient(app);
    await c.patch("/api/tasks/not-an-id").send({ title: "x" }).expect(404);
    await c.patch("/api/tasks/%7B%22%24ne%22%3A1%7D").send({ title: "x" }).expect(404);
  });
});

describe("account deletion", () => {
  test("deleting an account removes its tasks and requires the password", async () => {
    const c = await signedUpClient(app);
    await c.post("/api/tasks").send({ title: "x" });
    await c.delete("/api/account").send({ password: "nope nope" }).expect(401);
    await c.delete("/api/account").send({ password: c.password }).expect(200);
    await c.get("/api/auth/me").expect(401);
    await c.post("/api/auth/login").send({ email: c.email, password: c.password }).expect(401);
  });
});
