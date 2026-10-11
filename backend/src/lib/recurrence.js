// Date math on YYYY-MM-DD strings, done in UTC so results never depend on
// the server's time zone.

function parse(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function format(date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(ymd, days) {
  const d = parse(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return format(d);
}

export function nextOccurrence(ymd, repeat) {
  switch (repeat) {
    case "daily":
      return addDays(ymd, 1);
    case "weekly":
      return addDays(ymd, 7);
    case "weekdays": {
      let next = addDays(ymd, 1);
      while ([0, 6].includes(parse(next).getUTCDay())) next = addDays(next, 1);
      return next;
    }
    case "monthly": {
      const d = parse(ymd);
      const day = d.getUTCDate();
      const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
      const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
      target.setUTCDate(Math.min(day, lastDay));
      return format(target);
    }
    default:
      return null;
  }
}

export function isValidDate(ymd) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  return format(parse(ymd)) === ymd;
}
