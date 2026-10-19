import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { localeOf, type Lang } from "@/lib/i18n";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Axis ticks every `stride` points, always labelling the last one and dropping a tick that would sit under it. */
export function isAxisTick(index: number, count: number, stride: number): boolean {
  if (index === count - 1) return true;
  return index % stride === 0 && count - 1 - index >= stride;
}

/** References one of the 19 warm-shifted chart colors. */
export function chartColor(index: number): string {
  const clamped = ((Math.round(index) - 1) % 19 + 19) % 19 + 1;
  return `var(--chart-${clamped})`;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "2h 15m" / "2 小时 15 分"; under a minute collapses to seconds. */
export function formatDuration(seconds: number, lang: Lang): string {
  const total = Math.max(0, Math.round(seconds));
  if (total === 0) return lang === "zh" ? "0 秒" : "0s";
  if (total < 60) return lang === "zh" ? `${total} 秒` : `${total}s`;
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  if (hours === 0) return lang === "zh" ? `${minutes} 分` : `${minutes}m`;
  if (minutes === 0) return lang === "zh" ? `${hours} 小时` : `${hours}h`;
  return lang === "zh" ? `${hours} 小时 ${minutes} 分` : `${hours}h ${minutes}m`;
}

/** Fixed-width clock, good for tables: 1:05:30 */
export function formatDurationClock(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(secs)}` : `${minutes}:${pad(secs)}`;
}

export function formatNumber(value: number, lang: Lang): string {
  return new Intl.NumberFormat(localeOf[lang]).format(value);
}

export function formatPercent(value: number, lang: Lang, digits = 1): string {
  return new Intl.NumberFormat(localeOf[lang], {
    style: "percent",
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value / 100);
}

export function formatClock(ms: number | null, lang: Lang, withSeconds = false): string {
  if (!ms) return "—";
  const date = new Date(ms);
  const base = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  return withSeconds ? `${base}:${pad(date.getSeconds())}` : base;
}

export function formatDayLabel(
  ms: number | string,
  lang: Lang,
  style: "short" | "medium" | "long" = "short",
  withYear = style === "long"
): string {
  const date = typeof ms === "number" ? new Date(ms) : parseDayKey(ms);
  if (Number.isNaN(date.getTime())) return String(ms);
  return new Intl.DateTimeFormat(localeOf[lang], {
    month: style === "short" ? "numeric" : "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
    ...(style === "medium" ? { weekday: "short" } : {}),
  }).format(date);
}

export function formatMonthLabel(yyyyMm: string, lang: Lang, withYear = false): string {
  const [year, month] = yyyyMm.split("-").map(Number);
  const date = new Date(year, (month ?? 1) - 1, 1);
  return new Intl.DateTimeFormat(localeOf[lang], {
    ...(withYear ? { year: "numeric" } : {}),
    month: "short",
  }).format(date);
}

/** Axis labels: terse period keys, either "YYYY-MM" months or "YYYY-MM-DD" days. */
export function formatPeriodLabel(period: string, lang: Lang): string {
  return period.length === 7 ? formatMonthLabel(period, lang) : formatDayLabel(period, lang, "short", false);
}

/** Hover-card labels: the same, but a period outside this year spells the date out in full. */
export function formatPeriodDetail(period: string, lang: Lang): string {
  const stale = Number(period.slice(0, 4)) !== new Date().getFullYear();
  return period.length === 7
    ? formatMonthLabel(period, lang, stale)
    : formatDayLabel(period, lang, "short", stale);
}

/** Span for hover cards and comparisons: "10/6 - 10/12", dated with the year when needed. */
export function formatDateRange(from: number, toExclusive: number, lang: Lang): string {
  const start = new Date(from);
  const end = new Date(Math.max(from, toExclusive - 1));
  const stale = start.getFullYear() !== new Date().getFullYear();
  // A span that crosses into another year has to date both ends or the second one reads wrong.
  const splitYears = start.getFullYear() !== end.getFullYear();
  return `${formatDayLabel(from, lang, "short", stale || splitYears)} - ${formatDayLabel(end.getTime(), lang, "short", splitYears)}`;
}

/** Time range for hover cards; spans under five minutes show seconds. */
export function formatSpan(start: number, end: number, lang: Lang): string {
  const precise = end - start < 5 * 60_000;
  return `${formatClock(start, lang, precise)} – ${formatClock(end, lang, precise)}`;
}

/** Day plus clock, for timestamps that may sit outside today. */
export function formatDateTime(ms: number | null, lang: Lang): string {
  if (!ms) return "—";
  const stale = new Date(ms).getFullYear() !== new Date().getFullYear();
  return `${formatDayLabel(ms, lang, "short", stale)} ${formatClock(ms, lang)}`;
}

/** "YYYY-MM-DD" parsed as a local date. */
export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Calendar-safe day arithmetic on local "YYYY-MM-DD" keys. */
export function addDaysKey(key: string, days: number): string {
  const date = parseDayKey(key);
  date.setDate(date.getDate() + days);
  return toDayKey(date);
}

export function toDayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const APP_ALIASES: Array<[RegExp, string]> = [
  [/^code/i, "VS Code"],
  [/^cursor/i, "Cursor"],
  [/^qoder/i, "Qoder"],
  [/^idea64/i, "IntelliJ IDEA"],
  [/^pycharm/i, "PyCharm"],
  [/^webstorm/i, "WebStorm"],
  [/^clion/i, "CLion"],
  [/^goland/i, "GoLand"],
  [/^chrome/i, "Chrome"],
  [/^msedge/i, "Edge"],
  [/^firefox/i, "Firefox"],
  [/^brave/i, "Brave"],
  [/^weixin|^wechat/i, "WeChat"],
  [/^dingtalk/i, "DingTalk"],
  [/^feishu/i, "Feishu"],
  [/^windowsterminal|^wt$/i, "Terminal"],
  [/^powershell/i, "PowerShell"],
  [/^explorer$/i, "Explorer"],
];

/** Turns "chrome.exe" / "Qoder CN.exe" into a label worth showing in a chart. */
export function prettyAppName(raw: string): string {
  const cleaned = raw.replace(/\.exe$/i, "").trim();
  const hit = APP_ALIASES.find(([re]) => re.test(cleaned));
  return hit ? hit[1] : cleaned;
}

export function truncate(value: string, max: number): string {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** `now` is passed in rather than read here: the clock is off-limits during prerender. */
export function relativeTime(ms: number | null, lang: Lang, now: number): string {
  if (!ms) return "—";
  const diff = now - ms;
  const rtf = new Intl.RelativeTimeFormat(localeOf[lang], { numeric: "auto" });
  const minutes = Math.round(diff / 60000);
  if (Math.abs(minutes) < 60) return rtf.format(-minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return rtf.format(-hours, "hour");
  return rtf.format(-Math.round(hours / 24), "day");
}

export function hourLabel(hour: number, lang: Lang): string {
  if (lang === "zh") return `${hour}时`;
  const suffix = hour < 12 ? "am" : "pm";
  const base = hour % 12 === 0 ? 12 : hour % 12;
  return `${base}${suffix}`;
}

export const WEEKDAYS: Record<Lang, string[]> = {
  zh: ["一", "二", "三", "四", "五", "六", "日"],
  en: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
};

export const WEEKDAYS_LONG: Record<Lang, string[]> = {
  zh: ["周一", "周二", "周三", "周四", "周五", "周六", "周日"],
  en: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
};
