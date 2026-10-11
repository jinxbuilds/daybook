import { dueLabel, longDate, toYmd } from "./dates.js";

const PRIORITY_RANK = { high: 0, medium: 1, low: 2, none: 3 };

export const byPriorityThenDue = (a, b) =>
  PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
  (a.dueDate || "9999").localeCompare(b.dueDate || "9999") ||
  a.createdAt.localeCompare(b.createdAt);

const byDueThenPriority = (a, b) =>
  (a.dueDate || "9999").localeCompare(b.dueDate || "9999") ||
  PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
  a.createdAt.localeCompare(b.createdAt);

function matches(task, q) {
  if (!q) return true;
  const needle = q.toLowerCase();
  return [task.title, task.notes, task.project].some((s) => s && s.toLowerCase().includes(needle));
}

function timeline(tasks, now) {
  const overdue = [], todays = [], later = [], undated = [];
  for (const t of tasks) {
    if (!t.dueDate) undated.push(t);
    else if (t.dueDate < now) overdue.push(t);
    else if (t.dueDate === now) todays.push(t);
    else later.push(t);
  }
  return [
    { key: "overdue", label: "Overdue", tone: "overdue", tasks: overdue.sort(byDueThenPriority) },
    { key: "today", label: "Today", tone: "today", hideDue: true, tasks: todays.sort(byPriorityThenDue) },
    { key: "later", label: "Coming up", tasks: later.sort(byDueThenPriority) },
    { key: "undated", label: "No date", tasks: undated.sort(byPriorityThenDue) },
  ].filter((g) => g.tasks.length);
}

export function counts(tasks, now) {
  const open = tasks.filter((t) => !t.completed);
  const projects = new Map();
  for (const t of open) if (t.project) projects.set(t.project, (projects.get(t.project) || 0) + 1);
  // Include projects that only have completed tasks, so they stay reachable.
  for (const t of tasks) if (t.project && !projects.has(t.project)) projects.set(t.project, 0);
  return {
    today: open.filter((t) => t.dueDate && t.dueDate <= now).length,
    overdue: open.filter((t) => t.dueDate && t.dueDate < now).length,
    upcoming: open.filter((t) => t.dueDate && t.dueDate > now).length,
    all: open.length,
    projects: [...projects.entries()].sort((a, b) => a[0].localeCompare(b[0])),
  };
}

export const VIEWS = {
  today: { title: "Today", nav: "Today" },
  upcoming: { title: "Upcoming", nav: "Upcoming" },
  all: { title: "All tasks", nav: "All tasks" },
  done: { title: "Done", nav: "Done" },
};

export function buildView({ view, project, tasks, query, now }) {
  const open = tasks.filter((t) => !t.completed && matches(t, query));

  if (project) {
    const inProject = tasks.filter((t) => t.project === project && matches(t, query));
    const done = inProject.filter((t) => t.completed);
    const groups = timeline(inProject.filter((t) => !t.completed), now);
    if (done.length) groups.push({ key: "done", label: "Done", tasks: done.slice(0, 20), muted: true });
    return {
      title: `#${project}`,
      groups,
      empty: { title: `Nothing left in #${project}`, body: `Add a task here and it goes straight into #${project}.` },
    };
  }

  switch (view) {
    case "today": {
      const due = open.filter((t) => t.dueDate && t.dueDate <= now);
      return {
        title: "Today",
        subtitle: longDate(now),
        groups: timeline(due, now),
        empty: query
          ? { title: "No matches today", body: "Try another word, or look in All tasks." }
          : { title: "Your day is clear", body: "Add something below, or pull a task forward from Upcoming." },
      };
    }
    case "upcoming": {
      const future = open.filter((t) => t.dueDate && t.dueDate > now).sort(byDueThenPriority);
      const groups = [];
      for (const t of future) {
        const last = groups[groups.length - 1];
        if (last?.key === t.dueDate) last.tasks.push(t);
        else groups.push({ key: t.dueDate, label: dueLabel(t.dueDate, now), sub: longDate(t.dueDate), hideDue: true, tasks: [t] });
      }
      return {
        title: "Upcoming",
        groups,
        empty: { title: "Nothing scheduled ahead", body: "Give a task a date like \u201cfriday\u201d or \u201cnext week\u201d and it shows up here." },
      };
    }
    case "done": {
      const done = tasks
        .filter((t) => t.completed && matches(t, query))
        .sort((a, b) => (b.completedAt || "").localeCompare(a.completedAt || ""));
      const groups = [];
      for (const t of done) {
        const day = t.completedAt ? toYmd(new Date(t.completedAt)) : "";
        const last = groups[groups.length - 1];
        if (last?.key === day) last.tasks.push(t);
        else groups.push({ key: day, label: day ? dueLabel(day, now) : "Earlier", tasks: [t], muted: true });
      }
      return {
        title: "Done",
        groups,
        empty: { title: "Nothing completed yet", body: "Tick off a task and it lands here, in case you need it back." },
      };
    }
    default:
      return {
        title: "All tasks",
        groups: timeline(open, now),
        empty: query
          ? { title: "No matches", body: "Try a different word." }
          : { title: "No open tasks", body: "Add your first one below. Try \u201cWater plants every week\u201d." },
      };
  }
}
