// Central configuration. Every secret comes from the environment; the app
// refuses to start with a missing or placeholder secret instead of falling
// back to a default.

const PLACEHOLDER_SECRETS = new Set([
  "secret",
  "changeme",
  "change-me",
  "change_me",
  "your-secret",
  "your_jwt_secret",
  "jwt_secret",
  "replace-me",
  "replace-with-a-long-random-string",
]);

function required(name) {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable ${name}. See backend/.env.example.`);
  }
  return value.trim();
}

function int(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n)) throw new Error(`${name} must be an integer`);
  return n;
}

export function loadConfig() {
  const nodeEnv = process.env.NODE_ENV || "development";
  const isProd = nodeEnv === "production";

  const jwtSecret = required("JWT_SECRET");
  if (jwtSecret.length < 32 || PLACEHOLDER_SECRETS.has(jwtSecret.toLowerCase())) {
    throw new Error(
      "JWT_SECRET must be a random value of at least 32 characters. " +
        "Generate one with: node -e \"console.log(require('crypto').randomBytes(48).toString('base64url'))\""
    );
  }

  const clientOrigins = (process.env.CLIENT_ORIGIN || "")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean);
  if (clientOrigins.includes("*")) {
    throw new Error("CLIENT_ORIGIN cannot be '*' because the API uses credentialed requests.");
  }

  const sameSite = (process.env.COOKIE_SAMESITE || "strict").toLowerCase();
  if (!["strict", "lax", "none"].includes(sameSite)) {
    throw new Error("COOKIE_SAMESITE must be strict, lax or none");
  }
  const cookieSecure = process.env.COOKIE_SECURE
    ? process.env.COOKIE_SECURE === "true"
    : isProd;
  if (sameSite === "none" && !cookieSecure) {
    throw new Error("COOKIE_SAMESITE=none requires COOKIE_SECURE=true");
  }

  return Object.freeze({
    nodeEnv,
    isProd,
    port: int("PORT", 4000),
    mongoUri: required("MONGODB_URI"),
    jwtSecret,
    jwtTtlSeconds: int("JWT_TTL_SECONDS", 60 * 60 * 24 * 7),
    clientOrigins,
    cookieSecure,
    cookieSameSite: sameSite,
    trustProxy: int("TRUST_PROXY", 0),
    rateLimit: {
      windowMs: int("RATE_LIMIT_WINDOW_MS", 15 * 60 * 1000),
      apiMax: int("RATE_LIMIT_API_MAX", 300),
      authMax: int("RATE_LIMIT_AUTH_MAX", 10),
    },
    serveFrontend: process.env.SERVE_FRONTEND !== "false",
  });
}
