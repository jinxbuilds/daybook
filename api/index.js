// Vercel entry point: runs the Express API from backend/ as a serverless
// function on the same domain as the front end (vercel.json rewrites /api/*
// here), so session cookies stay first-party with SameSite=Strict.

// Vercel serves the built front end itself, and sits in front as one proxy.
process.env.SERVE_FRONTEND ??= "false";
process.env.TRUST_PROXY ??= "1";

let ready;
async function getApp() {
  ready ??= (async () => {
    const { loadConfig } = await import("../backend/src/config.js");
    const { connectDb } = await import("../backend/src/db.js");
    const { createApp } = await import("../backend/src/app.js");
    const config = loadConfig();
    await connectDb(config.mongoUri); // reused across warm invocations
    return createApp(config);
  })().catch((err) => {
    ready = undefined; // retry on the next request
    throw err;
  });
  return ready;
}

export default async function handler(req, res) {
  // The static demo deployment has no database configured.
  if (!process.env.MONGODB_URI) {
    res.statusCode = 503;
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ error: "The API isn't configured on this deployment." }));
  }
  try {
    const app = await getApp();
    return app(req, res);
  } catch (err) {
    // Log the reason only; connection strings can contain credentials.
    console.error(`Daybook API failed to start: ${err.message}`);
    res.statusCode = 500;
    res.setHeader("content-type", "application/json");
    return res.end(JSON.stringify({ error: "The server isn't available right now. Try again shortly." }));
  }
}
