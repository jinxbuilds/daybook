import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { authenticator } from "otplib";
import mongoose from "mongoose";
import { setup, teardown, client, signedUpClient } from "./helpers.js";

let app;
before(async () => ({ app } = await setup()));
after(teardown);

const stepNow = () => Math.floor(Date.now() / 1000 / 30);

test("[SC-10] two-factor sign-in: enable, require, replay protection, recovery codes, disable", async () => {
  const c = await signedUpClient(app);

  const setupRes = await c.post("/api/account/mfa/setup");
  assert.equal(setupRes.status, 200);
  assert.match(setupRes.body.qrDataUrl, /^data:image\/png;base64,/);
  const secret = setupRes.body.secret;

  await c.post("/api/account/mfa/enable").send({ code: "000000" }).expect(400);
  const enable = await c.post("/api/account/mfa/enable").send({ code: authenticator.generate(secret) });
  assert.equal(enable.status, 200);
  assert.equal(enable.body.user.mfaEnabled, true);
  assert.equal(enable.body.recoveryCodes.length, 8);

  // Recovery codes are stored hashed.
  const doc = await mongoose.connection.db.collection("users").findOne({ email: c.email });
  assert.ok(!doc.mfa.recoveryCodes.includes(enable.body.recoveryCodes[0]));

  // Password alone no longer signs in.
  const fresh = await client(app);
  const step1 = await fresh.post("/api/auth/login").send({ email: c.email, password: c.password });
  assert.deepEqual(step1.body, { mfaRequired: true });
  assert.ok(!step1.headers["set-cookie"]?.some((h) => h.startsWith("daybook_session=")));
  await fresh.get("/api/auth/me").expect(401);

  await fresh.post("/api/auth/login").send({ email: c.email, password: c.password, code: "123456" }).expect(401);

  // The code used to enable is already spent (replay protection) - use the next step's code.
  await mongoose.connection.db.collection("users").updateOne({ email: c.email }, { $set: { "mfa.lastUsedStep": stepNow() - 2 } });
  const code = authenticator.generate(secret);
  await fresh.post("/api/auth/login").send({ email: c.email, password: c.password, code }).expect(200);
  await fresh.get("/api/auth/me").expect(200);

  const replay = await client(app);
  await replay.post("/api/auth/login").send({ email: c.email, password: c.password, code }).expect(401);

  // Recovery code works exactly once.
  const rc = enable.body.recoveryCodes[0];
  const r1 = await client(app);
  await r1.post("/api/auth/login").send({ email: c.email, password: c.password, code: rc }).expect(200);
  const r2 = await client(app);
  await r2.post("/api/auth/login").send({ email: c.email, password: c.password, code: rc }).expect(401);

  // Disable needs password + a valid code.
  await fresh.post("/api/account/mfa/disable").send({ password: c.password, code: "000000" }).expect(401);
  const dis = await fresh.post("/api/account/mfa/disable").send({ password: c.password, code: enable.body.recoveryCodes[1] });
  assert.equal(dis.status, 200);
  assert.equal(dis.body.user.mfaEnabled, false);
  const after = await client(app);
  const plain = await after.post("/api/auth/login").send({ email: c.email, password: c.password });
  assert.ok(plain.body.user);
});
