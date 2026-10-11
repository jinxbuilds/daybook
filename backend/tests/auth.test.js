import { test, before, after, describe } from "node:test";
import assert from "node:assert/strict";
import jwt from "jsonwebtoken";
import request from "supertest";
import mongoose from "mongoose";
import { setup, teardown, client, signedUpClient, TEST_SECRET } from "./helpers.js";

let app;
before(async () => ({ app } = await setup()));
after(teardown);

describe("sign up and sign in", () => {
  test("register creates a session with secure cookie flags", async () => {
    const c = await client(app);
    const res = await c.post("/api/auth/register").send({ email: "Ana@Example.com", username: "ana", password: "long enough pw" });
    assert.equal(res.status, 201);
    assert.equal(res.body.user.email, "ana@example.com");
    assert.equal(res.body.user.passwordHash, undefined);
    const cookie = res.headers["set-cookie"].find((h) => h.startsWith("daybook_session="));
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    const me = await c.get("/api/auth/me");
    assert.equal(me.status, 200);
    assert.equal(me.body.user.username, "ana");
  });

  test("[SC-12] the session token is never returned in a response body", async () => {
    const c = await signedUpClient(app);
    const res = await c.post("/api/auth/login").send({ email: c.email, password: c.password });
    assert.equal(res.status, 200);
    assert.doesNotMatch(JSON.stringify(res.body), /eyJ/); // no JWT anywhere in JSON
  });

  test("[SC-09] passwords are stored as bcrypt hashes, never plain text", async () => {
    const c = await signedUpClient(app);
    const doc = await mongoose.connection.db.collection("users").findOne({ email: c.email });
    assert.match(doc.passwordHash, /^\$2[aby]\$12\$/);
    assert.equal(doc.password, undefined);
    assert.ok(!JSON.stringify(doc).includes(c.password));
  });

  test("duplicate email is rejected", async () => {
    const c = await signedUpClient(app);
    const other = await client(app);
    const res = await other.post("/api/auth/register").send({ email: c.email, username: "x", password: "another password" });
    assert.equal(res.status, 409);
  });

  test("weak passwords are rejected", async () => {
    const c = await client(app);
    const res = await c.post("/api/auth/register").send({ email: "weak@example.com", username: "w", password: "short" });
    assert.equal(res.status, 400);
  });

  test("wrong password and unknown email give the same answer", async () => {
    const c = await signedUpClient(app);
    const a = await c.post("/api/auth/login").send({ email: c.email, password: "wrong password" });
    const b = await c.post("/api/auth/login").send({ email: "nobody@example.com", password: "wrong password" });
    assert.equal(a.status, 401);
    assert.equal(b.status, 401);
    assert.equal(a.body.error, b.body.error);
  });

  test("/auth/session reports signed-out without an error", async () => {
    const res = await request(app).get("/api/auth/session");
    assert.equal(res.status, 200);
    assert.equal(res.body.user, null);
    const c = await signedUpClient(app);
    const me = await c.get("/api/auth/session");
    assert.equal(me.body.user.email, c.email);
  });

  test("logout clears the session", async () => {
    const c = await signedUpClient(app);
    await c.post("/api/auth/logout").expect(200);
    await c.get("/api/auth/me").expect(401);
  });
});

describe("[SC-01] query injection", () => {
  test("operator objects in login fields are rejected", async () => {
    await signedUpClient(app);
    const c = await client(app);
    for (const body of [
      { email: { $ne: null }, password: { $ne: null } },
      { email: { $gt: "" }, password: "x" },
      { email: "a@example.com", password: { $regex: ".*" } },
    ]) {
      const res = await c.post("/api/auth/login").send(body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.equal(res.headers["set-cookie"]?.some((h) => h.startsWith("daybook_session=")) ?? false, false);
    }
  });
});

describe("[SC-07] JWT handling", () => {
  async function meWith(token) {
    return request(app).get("/api/auth/me").set("Cookie", `daybook_session=${token}`);
  }

  test("tokens signed with another secret are rejected", async () => {
    const c = await signedUpClient(app);
    const forged = jwt.sign({ tv: 0 }, "attacker-secret-attacker-secret-1234", { subject: c.user.id, issuer: "daybook" });
    assert.equal((await meWith(forged)).status, 401);
  });

  test("alg:none tokens are rejected", async () => {
    const c = await signedUpClient(app);
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const body = Buffer.from(JSON.stringify({ sub: c.user.id, tv: 0, iss: "daybook" })).toString("base64url");
    assert.equal((await meWith(`${header}.${body}.`)).status, 401);
  });

  test("expired tokens are rejected", async () => {
    const c = await signedUpClient(app);
    const old = jwt.sign({ tv: 0, exp: Math.floor(Date.now() / 1000) - 10 }, TEST_SECRET, { subject: c.user.id, issuer: "daybook" });
    assert.equal((await meWith(old)).status, 401);
  });

  test("valid token works, and changing the password revokes old sessions", async () => {
    const c = await signedUpClient(app);
    const token = jwt.sign({ tv: 0 }, TEST_SECRET, { subject: c.user.id, issuer: "daybook", algorithm: "HS256" });
    assert.equal((await meWith(token)).status, 200);
    await c.post("/api/account/password").send({ currentPassword: c.password, newPassword: "a brand new password" }).expect(200);
    assert.equal((await meWith(token)).status, 401, "old token must stop working");
    await c.get("/api/auth/me").expect(200); // current browser was re-issued a session
  });
});

describe("[SC-03] CSRF protection", () => {
  test("state-changing requests without the CSRF header are refused", async () => {
    const c = await signedUpClient(app);
    const res = await c.agent.post("/api/tasks").send({ title: "x" });
    assert.equal(res.status, 403);
  });

  test("a wrong or forged CSRF token is refused", async () => {
    const c = await signedUpClient(app);
    const bad = await c.agent.post("/api/tasks").set("x-csrf-token", "abc.def").send({ title: "x" });
    assert.equal(bad.status, 403);
    const other = await client(app); // valid token belonging to another browser
    const res = await c.agent.post("/api/tasks").set("x-csrf-token", other.token).send({ title: "x" });
    assert.equal(res.status, 403);
  });

  test("login is CSRF-protected too", async () => {
    const res = await request(app).post("/api/auth/login").send({ email: "a@example.com", password: "x" });
    assert.equal(res.status, 403);
  });

  test("with the token, the request succeeds", async () => {
    const c = await signedUpClient(app);
    await c.post("/api/tasks").send({ title: "x" }).expect(201);
  });
});
