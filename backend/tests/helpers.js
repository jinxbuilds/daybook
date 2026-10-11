import crypto from "node:crypto";
import request from "supertest";
import mongoose from "mongoose";
import { connectDb } from "../src/db.js";
import { createApp } from "../src/app.js";

export const TEST_SECRET = crypto.randomBytes(48).toString("base64url");

export function testConfig(overrides = {}) {
  return {
    nodeEnv: "test",
    isProd: false,
    port: 0,
    mongoUri: process.env.TEST_MONGODB_URI || "mongodb://127.0.0.1:27017/daybook_test",
    jwtSecret: TEST_SECRET,
    jwtTtlSeconds: 3600,
    clientOrigins: ["http://localhost:5173"],
    cookieSecure: false,
    cookieSameSite: "strict",
    trustProxy: 0,
    rateLimit: { windowMs: 60_000, apiMax: 10_000, authMax: 10_000 },
    serveFrontend: false,
    ...overrides,
  };
}

const silent = { info() {}, error() {} };

export async function setup(overrides) {
  const config = testConfig(overrides);
  if (mongoose.connection.readyState !== 1) await connectDb(config.mongoUri);
  await mongoose.connection.db.dropDatabase();
  const { User } = await import("../src/models/User.js");
  await User.syncIndexes();
  return { app: createApp(config, { logger: silent }), config };
}

export async function teardown() {
  await mongoose.disconnect();
}

// A browser-like client: keeps cookies and sends the CSRF header.
export async function client(app) {
  const agent = request.agent(app);
  const res = await agent.get("/api/auth/csrf");
  const token = res.body.csrfToken;
  const wrap = (method) => (url) => agent[method](url).set("x-csrf-token", token);
  return { agent, token, get: (u) => agent.get(u), post: wrap("post"), patch: wrap("patch"), delete: wrap("delete") };
}

let n = 0;
export async function signedUpClient(app, extra = {}) {
  const c = await client(app);
  const email = `user${++n}-${Date.now()}@example.com`;
  const password = "correct horse battery";
  const res = await c.post("/api/auth/register").send({ email, username: `user${n}`, password, ...extra });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { ...c, email, password, user: res.body.user };
}
