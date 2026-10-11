// Dates are handled as local-calendar YYYY-MM-DD strings.

const pad = (n) => String(n).padStart(2, "0");
export const toYmd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromYmd = (s) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const today = () => toYmd(new Date());
export const addDays = (ymd, n) => {
  const d = fromYmd(ymd);
  d.setDate(d.getDate() + n);
  return toYmd(d);
};
export const diffDays = (a, b) => Math.round((fromYmd(a) - fromYmd(b)) / 86400000);

export function dueLabel(ymd, now = today()) {
  if (!ymd) return "";
  const diff = diffDays(ymd, now);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  const d = fromYmd(ymd);
  if (diff > 1 && diff < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
  const sameYear = d.getFullYear() === fromYmd(now).getFullYear();
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", ...(sameYear ? {} : { year: "numeric" }) });
}

export function dueTone(ymd, now = today()) {
  if (!ymd) return "";
  const diff = diffDays(ymd, now);
  if (diff < 0) return "overdue";
  if (diff === 0) return "today";
  return "later";
}

export function longDate(ymd) {
  return fromYmd(ymd).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}
