import { today, addDays, fromYmd, toYmd } from "./dates.js";

// Parses "Pay rent friday !high #home every month" into task fields.

const PRIORITY = {
  "!high": "high", "!h": "high", "!1": "high",
  "!medium": "medium", "!med": "medium", "!m": "medium", "!2": "medium",
  "!low": "low", "!l": "low", "!3": "low",
};
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const REPEATS = [
  [/\b(every ?day|daily)\b/i, "daily"],
  [/\b(every ?weekday|weekdays)\b/i, "weekdays"],
  [/\b(every ?week|weekly)\b/i, "weekly"],
  [/\b(every ?month|monthly)\b/i, "monthly"],
];

function nextWeekday(name, now) {
  const target = WEEKDAYS.findIndex((w) => w.startsWith(name));
  const d = fromYmd(now);
  let delta = (target - d.getDay() + 7) % 7;
  if (delta === 0) delta = 7;
  return addDays(now, delta);
}

export function parseQuickAdd(input, now = today()) {
  let text = ` ${input} `;
  const out = { dueDate: null, priority: "none", project: "", repeat: "none" };
  const take = (re, fn) => {
    const m = text.match(re);
    if (!m) return;
    fn(m);
    text = text.replace(m[0], " ");
  };

  for (const [re, value] of REPEATS) take(re, () => (out.repeat = value));

  take(/\s(!(?:high|medium|med|low|h|m|l|1|2|3))(?=\s)/i, (m) => (out.priority = PRIORITY[m[1].toLowerCase()]));

  take(/\s#([\p{L}\p{N}_-]{1,40})(?=\s)/u, (m) => (out.project = m[1]));

  take(/\s(today|tod)(?=\s)/i, () => (out.dueDate = now));
  take(/\s(tomorrow|tmrw|tmr)(?=\s)/i, () => (out.dueDate = addDays(now, 1)));
  take(/\syesterday(?=\s)/i, () => (out.dueDate = addDays(now, -1)));
  take(/\snext week(?=\s)/i, () => (out.dueDate = addDays(now, 7)));
  take(/\sin (\d{1,3}) days?(?=\s)/i, (m) => (out.dueDate = addDays(now, Number(m[1]))));
  take(/\s(\d{4}-\d{2}-\d{2})(?=\s)/, (m) => (out.dueDate = m[1]));
  take(new RegExp(`\\s(${MONTHS.join("|")})[a-z]*\\.? (\\d{1,2})(?=\\s)`, "i"), (m) => {
    const d = fromYmd(now);
    let date = new Date(d.getFullYear(), MONTHS.indexOf(m[1].toLowerCase()), Number(m[2]));
    if (date < d) date = new Date(d.getFullYear() + 1, date.getMonth(), date.getDate());
    out.dueDate = toYmd(date);
  });
  if (!out.dueDate) {
    take(/\s(?:on )?(mon|tue|tues|wed|thu|thur|thurs|fri|sat|sun)(?:day|nesday|sday|urday)?(?=\s)/i, (m) => {
      out.dueDate = nextWeekday(m[1].toLowerCase().slice(0, 3), now);
    });
  }

  if (out.repeat !== "none" && !out.dueDate) {
    out.dueDate = now;
    if (out.repeat === "weekdays") {
      while ([0, 6].includes(fromYmd(out.dueDate).getDay())) out.dueDate = addDays(out.dueDate, 1);
    }
  }
  out.title = text.replace(/\s+/g, " ").trim();
  return out;
}
