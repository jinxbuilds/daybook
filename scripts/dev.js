// Runs the API (with auto-restart) and the Vite dev server together.
// Usage: npm run dev   (from the repository root)
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

if (!existsSync("backend/.env")) {
  console.error("Missing backend/.env. Copy backend/.env.example to backend/.env and fill it in first.");
  process.exit(1);
}

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const procs = [
  ["api", ["run", "dev", "--workspace", "backend"]],
  ["web", ["run", "dev", "--workspace", "frontend"]],
].map(([name, args]) => {
  const child = spawn(npm, args, { stdio: ["inherit", "pipe", "pipe"], shell: process.platform === "win32" });
  const prefix = (chunk) =>
    chunk
      .toString()
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => `[${name}] ${line}`)
      .join("\n") + "\n";
  child.stdout.on("data", (c) => process.stdout.write(prefix(c)));
  child.stderr.on("data", (c) => process.stderr.write(prefix(c)));
  child.on("exit", (code) => {
    console.log(`[${name}] exited with code ${code}`);
    procs.forEach((p) => p !== child && p.kill());
    process.exit(code ?? 0);
  });
  return child;
});

const stop = () => procs.forEach((p) => p.kill());
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
