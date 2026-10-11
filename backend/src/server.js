import { loadConfig } from "./config.js";
import { connectDb, disconnectDb } from "./db.js";
import { createApp } from "./app.js";
import { logger } from "./lib/logger.js";

let config;
try {
  config = loadConfig();
} catch (err) {
  console.error(`Configuration error: ${err.message}`);
  process.exit(1);
}

try {
  await connectDb(config.mongoUri);
  logger.info("Connected to MongoDB");
} catch (err) {
  // Log the reason only; the connection string can contain credentials.
  console.error(`Could not connect to MongoDB: ${err.message}`);
  process.exit(1);
}

const server = createApp(config).listen(config.port, () => {
  logger.info(`Daybook API listening on http://localhost:${config.port}`);
});

const shutdown = async () => {
  server.close();
  await disconnectDb();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
