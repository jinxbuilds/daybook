import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import helmet from "helmet";
import cors from "cors";
import cookieParser from "cookie-parser";
import { createSessionTools } from "./middleware/session.js";
import { createCsrf, CSRF_HEADER } from "./middleware/csrf.js";
import { createLimiters } from "./middleware/rateLimit.js";
import { errorHandler, notFoundHandler } from "./middleware/errors.js";
import { requestLog } from "./middleware/requestLog.js";
import { authRoutes } from "./routes/auth.js";
import { accountRoutes } from "./routes/account.js";
import { taskRoutes } from "./routes/tasks.js";
import { logger as defaultLogger } from "./lib/logger.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND_DIST = path.resolve(here, "../../frontend/dist");

export function createApp(config, { logger = defaultLogger } = {}) {
  const app = express();
  app.disable("x-powered-by");
  if (config.trustProxy) app.set("trust proxy", config.trustProxy);

  app.use(helmet());
  app.use(requestLog(logger));

  const session = createSessionTools(config);
  const csrf = createCsrf(config);
  const limiters = createLimiters(config);

  const api = express.Router();
  // Only the configured front-end origins may make credentialed requests.
  // Same-origin requests (the built app served by this server) need no CORS.
  api.use(
    cors({
      origin: (origin, cb) => cb(null, !origin ? false : config.clientOrigins.includes(origin)),
      credentials: true,
      methods: ["GET", "POST", "PATCH", "DELETE"],
      allowedHeaders: ["Content-Type", CSRF_HEADER],
      maxAge: 600,
    })
  );
  api.use(limiters.api);
  api.use(express.json({ limit: "20kb" }));
  api.use(cookieParser());
  api.use((_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  api.use(csrf.protect);

  api.get("/health", (_req, res) => res.json({ ok: true }));
  api.use("/auth", authRoutes({ session, limiters, csrf }));
  api.use("/account", accountRoutes({ session, limiters }));
  api.use("/tasks", taskRoutes({ session }));
  api.use(notFoundHandler);

  app.use("/api", api);

  // In production the API also serves the built front end (same origin).
  if (config.serveFrontend && fs.existsSync(path.join(FRONTEND_DIST, "index.html"))) {
    app.use(express.static(FRONTEND_DIST, { index: false, maxAge: "1h" }));
    app.get("/{*splat}", (_req, res) => res.sendFile(path.join(FRONTEND_DIST, "index.html")));
  }

  app.use(notFoundHandler);
  app.use(errorHandler(logger));
  return app;
}
