// In-browser stand-in for the Daybook API, used when the app is built with
// VITE_DEMO=true. Data lives in this browser's localStorage, so the public
// demo needs no server or database. Mirrors the response shapes and rules of
// backend/src/routes (tasks, recurrence, validation).

import { addDays, today } from "./dates.js";

const KEY = "daybook-demo-v1";
const PRIORITIES = ["none", "low", "medium", "high"];
const REPEATS = ["none", "daily", "weekdays", "weekly", "monthly"];
const NOT_IN_DEMO = "Not available in the demo. The full app has accounts, two-factor sign-in and sync.";

export class DemoError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const now = () => new Date().toISOString();
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));

function seed() {
  const t = today();
  const task = (title, extra = {}) => ({
    id: uid(), title, notes: "", dueDate: null, priority: "none", project: "", repeat: "none",
    completed: false, completedAt: null, createdAt: now(), updatedAt: now(), ...extra,
  });
  return {
    user: { id: "demo", email: "demo@daybook.app", username: "Demo", mfaEnabled: false, createdAt: now() },
    signedIn: true,
    tasks: [
      task("Try quick add: type “Call mom tomorrow !high #family”", { dueDate: t, priority: "high" }),
      task("Pay rent", { dueDate: addDays(t, 3), priority: "high", project: "home", repeat: "monthly" }),
      task("Review pull requests", { dueDate: t, priority: "medium", project: "work", repeat: "weekdays" }),
      task("Water the plants", { dueDate: addDays(t, -1), project: "home", repeat: "weekly" }),
      task("Book dentist appointment", { dueDate: addDays(t, 5), priority: "low" }),
      task("Read 20 pages", { dueDate: t, repeat: "daily", notes: "Currently: a book on systems thinking." }),
      task("Plan weekend trip", { project: "personal" }),
      task("Set up the new laptop", { completed: true, completedAt: now(), project: "work" }),
    ],
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* storage unavailable: fall through to a fresh seed */
  }
  return seed();
}

let state = load();
function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode: keep working in memory */
  }
}

// Same rules as backend/src/lib/recurrence.js (UTC math on YYYY-MM-DD).
function nextOccurrence(ymd, repeat) {
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
  const fmt = (d) => d.toISOString().slice(0, 10);
  const plus = (s, n) => { const d = parse(s); d.setUTCDate(d.getUTCDate() + n); return fmt(d); };
  switch (repeat) {
    case "daily": return plus(ymd, 1);
    case "weekly": return plus(ymd, 7);
    case "weekdays": { let n = plus(ymd, 1); while ([0, 6].includes(parse(n).getUTCDay())) n = plus(n, 1); return n; }
    case "monthly": {
      const d = parse(ymd); const day = d.getUTCDate();
      const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
      const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
      target.setUTCDate(Math.min(day, last));
      return fmt(target);
    }
    default: return null;
  }
}

function validate(fields, partial) {
  const out = {};
  if ("title" in fields || !partial) {
    const title = String(fields.title ?? "").trim();
    if (!title) throw new DemoError(400, "title: is required");
    out.title = title.slice(0, 200);
  }
  if ("notes" in fields) out.notes = String(fields.notes ?? "").slice(0, 5000);
  if ("dueDate" in fields) {
    if (fields.dueDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(fields.dueDate)) throw new DemoError(400, "dueDate: must be a date in YYYY-MM-DD format");
    out.dueDate = fields.dueDate;
  }
  if ("priority" in fields) {
    if (!PRIORITIES.includes(fields.priority)) throw new DemoError(400, "priority: invalid value");
    out.priority = fields.priority;
  }
  if ("project" in fields) out.project = String(fields.project ?? "").trim().slice(0, 40);
  if ("repeat" in fields) {
    if (!REPEATS.includes(fields.repeat)) throw new DemoError(400, "repeat: invalid value");
    out.repeat = fields.repeat;
  }
  if ("completed" in fields) out.completed = Boolean(fields.completed);
  return out;
}

const findTask = (id) => {
  const task = state.tasks.find((t) => t.id === id);
  if (!task) throw new DemoError(404, "Task not found");
  return task;
};

const requireUser = () => {
  if (!state.signedIn) throw new DemoError(401, "Sign in to continue");
};

const routes = [
  ["GET", /^\/auth\/session$/, () => ({ user: state.signedIn ? state.user : null })],
  ["GET", /^\/auth\/me$/, () => (requireUser(), { user: state.user })],
  ["POST", /^\/auth\/(login|register)$/, () => { state.signedIn = true; return { user: state.user }; }],
  ["POST", /^\/auth\/logout$/, () => { state.signedIn = false; return { ok: true }; }],
  ["PATCH", /^\/account\/profile$/, (_m, body) => {
    requireUser();
    const name = String(body?.username ?? "").trim().slice(0, 40);
    if (name) state.user = { ...state.user, username: name };
    return { user: state.user };
  }],
  ["*", /^\/account(\/.*)?$/, () => { throw new DemoError(400, NOT_IN_DEMO); }],
  ["GET", /^\/tasks$/, () => {
    requireUser();
    const open = state.tasks.filter((t) => !t.completed).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const done = state.tasks.filter((t) => t.completed).sort((a, b) => String(b.completedAt).localeCompare(String(a.completedAt)));
    return { tasks: [...open, ...done] };
  }],
  ["POST", /^\/tasks\/clear-completed$/, () => {
    requireUser();
    const before = state.tasks.length;
    state.tasks = state.tasks.filter((t) => !t.completed);
    return { deleted: before - state.tasks.length };
  }],
  ["POST", /^\/tasks$/, (_m, body) => {
    requireUser();
    const f = validate(body ?? {}, false);
    const task = {
      id: uid(), notes: "", dueDate: null, priority: "none", project: "", repeat: "none",
      completed: false, completedAt: null, createdAt: now(), updatedAt: now(), ...f,
    };
    if (task.repeat !== "none" && !task.dueDate) throw new DemoError(400, "dueDate: repeating tasks need a due date");
    if (state.tasks.filter((t) => !t.completed).length >= 500) throw new DemoError(400, "The demo holds up to 500 open tasks.");
    state.tasks.push(task);
    return { task, status: 201 };
  }],
  ["PATCH", /^\/tasks\/([\w-]+)$/, (m, body) => {
    requireUser();
    const task = findTask(m[1]);
    const patch = validate(body ?? {}, true);
    if (Object.keys(patch).length === 0) throw new DemoError(400, "Nothing to update");
    const wasCompleted = task.completed;
    const merged = { ...task, ...patch };
    if (merged.repeat !== "none" && !merged.dueDate) throw new DemoError(400, "dueDate: repeating tasks need a due date");
    let next = null;
    if (patch.completed === true && !wasCompleted) {
      merged.completedAt = now();
      if (merged.repeat !== "none") {
        next = {
          id: uid(), title: merged.title, notes: merged.notes, priority: merged.priority, project: merged.project,
          repeat: merged.repeat, dueDate: nextOccurrence(merged.dueDate, merged.repeat),
          completed: false, completedAt: null, createdAt: now(), updatedAt: now(),
        };
        merged.repeat = "none";
        state.tasks.push(next);
      }
    } else if (patch.completed === false) {
      merged.completedAt = null;
    }
    merged.updatedAt = now();
    Object.assign(task, merged);
    return { task: { ...task }, next };
  }],
  ["DELETE", /^\/tasks\/([\w-]+)$/, (m) => {
    requireUser();
    findTask(m[1]);
    state.tasks = state.tasks.filter((t) => t.id !== m[1]);
    return { ok: true };
  }],
];

export async function demoApi(path, { method = "GET", body } = {}) {
  const clean = path.split("?")[0];
  for (const [verb, pattern, handler] of routes) {
    const m = clean.match(pattern);
    if (!m || (verb !== "*" && verb !== method)) continue;
    // A copy, so callers can't mutate stored state by accident.
    const result = handler(m, body === undefined ? undefined : JSON.parse(JSON.stringify(body)));
    save();
    await new Promise((r) => setTimeout(r, 60)); // feel like a network call
    const { status: _status, ...data } = result ?? {};
    return JSON.parse(JSON.stringify(data));
  }
  throw new DemoError(404, "Not found");
}

export function resetDemo() {
  state = seed();
  save();
}
