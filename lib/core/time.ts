/**
 * Local-time calendar helpers.
 *
 * The dashboard runs on the same machine as ActivityWatch, so the server's
 * timezone and the browser's timezone are the same and date keys can be
 * exchanged as plain "YYYY-MM-DD" strings without a timezone suffix.
 */

export type RangeKey =
  | "today"
  | "yesterday"
  | "week"
  | "last-week"
  | "month"
  | "last-month"
  | "last-7"
  | "last-30"
  | "year"
  | "custom";

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, d.getDate(), d.getHours(), d.getMinutes(), d.getSeconds(), d.getMilliseconds());
}

/** Weeks start on Monday. */
export function startOfWeek(d: Date): Date {
  const s = startOfDay(d);
  const shift = (s.getDay() + 6) % 7;
  return addDays(s, -shift);
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

export function dateKey(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Parses a "YYYY-MM-DD" key as a local date (not UTC). */
export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / DAY_MS);
}

export interface TimeRange {
  from: number;
  to: number;
  /** Resolved range key, useful for labelling. */
  key: RangeKey;
  /** Length of the range in days (rounded up). */
  days: number;
}

export function resolveRange(key: RangeKey, now: Date, from?: string, to?: string): TimeRange {
  let start: Date;
  let end: Date;

  switch (key) {
    case "today":
      start = startOfDay(now);
      end = new Date(now);
      break;
    case "yesterday":
      start = startOfDay(addDays(now, -1));
      end = startOfDay(now);
      break;
    case "week":
      start = startOfWeek(now);
      end = new Date(now);
      break;
    case "last-week":
      start = startOfWeek(addDays(now, -7));
      end = startOfWeek(now);
      break;
    case "month":
      start = startOfMonth(now);
      end = new Date(now);
      break;
    case "last-month":
      start = startOfMonth(addMonths(now, -1));
      end = startOfMonth(now);
      break;
    case "last-7":
      start = startOfDay(addDays(now, -6));
      end = new Date(now);
      break;
    case "last-30":
      start = startOfDay(addDays(now, -29));
      end = new Date(now);
      break;
    case "year":
      start = startOfDay(addDays(now, -364));
      end = new Date(now);
      break;
    case "custom":
      start = from ? startOfDay(parseDateKey(from)) : startOfDay(now);
      end = to ? endOfDay(parseDateKey(to)) : new Date(now);
      break;
    default:
      start = startOfDay(now);
      end = new Date(now);
  }

  if (end.getTime() <= start.getTime()) end = new Date(start.getTime() + 60 * 1000);
  return { from: start.getTime(), to: end.getTime(), key, days: Math.ceil((end.getTime() - start.getTime()) / DAY_MS) };
}

/** The equally-sized window immediately before the given range. */
export function previousRange(range: TimeRange): TimeRange {
  const span = range.to - range.from;
  return { from: range.from - span, to: range.from, key: "custom", days: Math.ceil(span / DAY_MS) };
}

/** The same window one year earlier (for year-over-year comparison). */
export function lastYearRange(range: TimeRange): TimeRange {
  const from = addMonths(new Date(range.from), -12);
  const to = addMonths(new Date(range.to), -12);
  return { from: from.getTime(), to: to.getTime(), key: "custom", days: Math.ceil((to.getTime() - from.getTime()) / DAY_MS) };
}

/** Day-aligned slices covering [from, to), used to chunk remote fetches. */
export function daySlices(from: number, to: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  let cursor = startOfDay(new Date(from)).getTime();
  while (cursor < to) {
    const next = Math.min(endOfDay(new Date(cursor)).getTime(), to);
    if (next > from) out.push([Math.max(cursor, from), next]);
    cursor = next;
  }
  return out;
}

export function isPastDay(dayStart: number): boolean {
  return endOfDay(new Date(dayStart)).getTime() <= Date.now();
}

export function hoursOfDay(ms: number): number {
  return new Date(ms).getHours();
}

/** Monday=0 … Sunday=6 */
export function weekdayIndex(ms: number): number {
  return (new Date(ms).getDay() + 6) % 7;
}
