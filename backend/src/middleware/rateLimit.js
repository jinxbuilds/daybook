import { rateLimit } from "express-rate-limit";

export function createLimiters(config) {
  const base = {
    windowMs: config.rateLimit.windowMs,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  };
  return {
    api: rateLimit({
      ...base,
      limit: config.rateLimit.apiMax,
      message: { error: "Too many requests. Wait a few minutes and try again." },
    }),
    // Login, sign-up, password and 2FA changes: brute-force targets.
    auth: rateLimit({
      ...base,
      limit: config.rateLimit.authMax,
      message: { error: "Too many attempts. Wait 15 minutes and try again." },
    }),
  };
}
