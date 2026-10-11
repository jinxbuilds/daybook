import { test, after, describe } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { setup, teardown, client, signedUpClient } from "./helpers.js";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";

after(teardown);

describe("[SC-06] rate limiting", () => {
  test("login attempts are limited per client", async () => {
    const { app } = await setup({ rateLimit: { windowMs: 60_000, apiMax: 10_000, authMax: 3 } });
    const c = await client(app);
    const attempt = () => c.post("/api/auth/login").send({ email: "x@example.com", password: "guess" });
    for (let i = 0; i < 3; i++) assert.equal((await attempt()).status, 401);
    const blocked = await attempt();
    assert.equal(blocked.status, 429);
    assert.ok(blocked.headers["ratelimit-policy"] || blocked.headers["ratelimit"]);
  });

  test("the whole API has a general limit", async () => {
    const { app } = await setup({ rateLimit: { windowMs: 60_000, apiMax: 5, authMax: 100 } });
    for (let i = 0; i < 5; i++) await request(app).get("/api/health");
    assert.equal((await request(app).get("/api/health")).status, 429);
  });
});

describe("[SC-11] CORS", () => {
  test("only the configured origin is allowed, with credentials", async () => {
    const { app } = await setup();
    const ok = await request(app).options("/api/tasks").set("Origin", "http://localhost:5173").set("Access-Control-Request-Method", "POST");
    assert.equal(ok.headers["access-control-allow-origin"], "http://localhost:5173");
    assert.equal(ok.headers["access-control-allow-credentials"], "true");
    const evil = await request(app).options("/api/tasks").set("Origin", "https://evil.example").set("Access-Control-Request-Method", "POST");
    assert.equal(evil.headers["access-control-allow-origin"], undefined);
    const get = await request(app).get("/api/health").set("Origin", "https://evil.example");
    assert.equal(get.headers["access-control-allow-origin"], undefined);
  });
});

describe("[SC-02] security headers", () => {
  test("helmet sets CSP and related headers", async () => {
    const { app } = await setup();
    const res = await request(app).get("/api/health");
    assert.match(res.headers["content-security-policy"], /default-src 'self'/);
    assert.equal(res.headers["x-content-type-options"], "nosniff");
    assert.equal(res.headers["x-powered-by"], undefined);
  });
});

describe("[SC-19] logging", () => {
  test("request logs contain no passwords, tokens, emails or query strings", async () => {
    const lines = [];
    const logger = { info: (m) => lines.push(m), error: (m) => lines.push(m) };
    const { config } = await setup();
    const app = createApp(config, { logger });
    const c = await signedUpClient(app);
    await c.post("/api/auth/login").send({ email: c.email, password: c.password });
    await c.get("/api/tasks?status=open");
    const out = lines.join("\n");
    assert.ok(lines.length > 0);
    assert.ok(!out.includes(c.password));
    assert.ok(!out.includes(c.email));
    assert.ok(!out.includes(c.token));
    assert.ok(!out.includes("status=open"));
    assert.ok(!/eyJ[\w-]+\./.test(out));
  });
});

describe("[SC-07][SC-18] configuration refuses unsafe secrets", () => {
  const base = { MONGODB_URI: "mongodb://127.0.0.1/x", CLIENT_ORIGIN: "http://localhost:5173" };
  const withEnv = (env, fn) => {
    const saved = { ...process.env };
    Object.assign(process.env, env);
    try { return fn(); } finally {
      for (const k of Object.keys(process.env)) if (!(k in saved)) delete process.env[k];
      Object.assign(process.env, saved);
    }
  };
  test("missing, short or placeholder JWT secrets fail fast", () => {
    for (const JWT_SECRET of ["", "short", "secret", "change-me"]) {
      assert.throws(() => withEnv({ ...base, JWT_SECRET }, loadConfig), /JWT_SECRET/);
    }
  });
  test("missing database URI fails fast", () => {
    assert.throws(() => withEnv({ ...base, MONGODB_URI: "", JWT_SECRET: "x".repeat(40) }, loadConfig), /MONGODB_URI/);
  });
  test("wildcard CORS origin is refused", () => {
    assert.throws(() => withEnv({ ...base, CLIENT_ORIGIN: "*", JWT_SECRET: "y".repeat(40) }, loadConfig), /CLIENT_ORIGIN/);
  });
  test("production defaults to Secure cookies", () => {
    const cfg = withEnv({ ...base, JWT_SECRET: "z".repeat(40), NODE_ENV: "production" }, loadConfig);
    assert.equal(cfg.cookieSecure, true);
  });
});
