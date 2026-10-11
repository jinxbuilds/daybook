const silent = process.env.LOG_LEVEL === "silent";
export const logger = {
  info: (msg) => !silent && console.log(`[${new Date().toISOString()}] ${msg}`),
  error: (msg) => !silent && console.error(`[${new Date().toISOString()}] ERROR ${msg}`),
};
