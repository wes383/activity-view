import type { TimedEvent } from "@/lib/aw/types";
import { hostFromUrl, type LoadedActivity } from "@/lib/aw/client";
import {
  categorize,
  classify,
  compileCategories,
  productivityScore,
  splitByWeight,
  type CategorySlice,
} from "@/lib/core/categories";
import {
  clipToIntervals,
  countSwitches,
  coverageDuration,
  findBreaks,
  groupBy,
  sumDuration,
  toSessions,
  type Interval,
} from "@/lib/core/intervals";
import {
  dateKey,
  endOfDay,
  parseDateKey,
  startOfDay,
  startOfMonth,
  startOfWeek,
  weekdayIndex,
  type RangeKey,
  type TimeRange,
} from "@/lib/core/time";
import type { Settings } from "@/lib/core/settings";

const SEC = 1000;
const MIN = 60 * SEC;

export interface RankedItem {
  key: string;
  duration: number;
  occurrences: number;
  longestRun: number;
  lastSeen: number | null;
}

export interface Heatmap {
  /** matrix[weekday][hour] in seconds, Monday first. */
  matrix: number[][];
  hourly: number[];
  max: number;
}

export interface PeriodEntry {
  period: string;
  from: number;
  to: number;
  active: number;
  score: number;
  byCategory: Record<string, number>;
}

function appOf(event: TimedEvent): string | null {
  const app = event.data.app;
  return typeof app === "string" && app.length > 0 ? app : null;
}

function titleOf(event: TimedEvent): string | null {
  const title = event.data.title;
  if (typeof title !== "string") return null;
  const trimmed = title.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function cleanAppName(app: string): string {
  return app.replace(/\.exe$/i, "").replace(/\s+/g, " ").trim();
}

function appKey(event: TimedEvent): string | null {
  const app = appOf(event);
  return app ? cleanAppName(app) : null;
}

function inRange(events: TimedEvent[], from: number, to: number): TimedEvent[] {
  return clipToIntervals(events, [{ start: from, end: to }]);
}

function rank(groups: ReturnType<typeof groupBy>): RankedItem[] {
  return groups.map((g) => ({
    key: g.key,
    duration: Math.round(g.duration / SEC),
    occurrences: g.occurrences,
    longestRun: Math.round(g.longestRun / SEC),
    lastSeen: g.lastSeen,
  }));
}

function intoHeatmap(events: TimedEvent[]): Heatmap {
  const matrix: number[][] = Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
  const hourly = new Array<number>(24).fill(0);
  for (const ev of events) {
    let cursor = ev.start;
    while (cursor < ev.end) {
      const date = new Date(cursor);
      const hourEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours() + 1).getTime();
      const slice = Math.min(hourEnd, ev.end) - cursor;
      matrix[weekdayIndex(cursor)][date.getHours()] += slice;
      hourly[date.getHours()] += slice;
      cursor = hourEnd;
    }
  }
  let max = 0;
  for (const row of matrix) for (const value of row) max = Math.max(max, value);
  return {
    matrix: matrix.map((row) => row.map((value) => Math.round(value / SEC))),
    hourly: hourly.map((value) => Math.round(value / SEC)),
    max: Math.round(max / SEC),
  };
}

export interface OverviewPayload {
  range: { from: number; to: number; key: RangeKey };
  device: { hostname: string; windowBuckets: string[]; webBuckets: string[] };
  totals: {
    today: number;
    week: number;
    month: number;
    range: number;
    afk: number;
    browsing: number;
    activeDays: number;
    averagePerDay: number;
    switches: number;
  };
  topApps: RankedItem[];
  topDomains: RankedItem[];
  topUrls: RankedItem[];
  topTitles: RankedItem[];
  heatmap: Heatmap;
  busiestHour: number | null;
}

export function buildOverview(
  loaded: LoadedActivity,
  settings: Settings,
  range: TimeRange,
  now: Date
): OverviewPayload {
  const active = inRange(loaded.active, range.from, range.to);
  const raw = inRange(loaded.raw, range.from, range.to);
  const web = inRange(loaded.web, range.from, range.to).filter((e) => hostFromUrl(e.data.url) !== null);

  const nowMs = now.getTime();
  const today = coverageDuration(inRange(loaded.active, startOfDay(now).getTime(), nowMs));
  const week = coverageDuration(inRange(loaded.active, startOfWeek(now).getTime(), nowMs));
  const month = coverageDuration(inRange(loaded.active, startOfMonth(now).getTime(), nowMs));

  const tolerance = settings.gapToleranceSec * SEC;
  const rangeSeconds = coverageDuration(active);
  const activeDays = new Set(active.map((e) => dateKey(new Date(e.start)))).size;

  const heatmap = intoHeatmap(active);
  let busiestHour: number | null = null;
  let best = 0;
  heatmap.hourly.forEach((value, index) => {
    if (value > best) {
      best = value;
      busiestHour = index;
    }
  });

  return {
    range: { from: range.from, to: range.to, key: range.key },
    device: { hostname: loaded.hostname, windowBuckets: loaded.buckets.window, webBuckets: loaded.buckets.web },
    totals: {
      today: Math.round(today / SEC),
      week: Math.round(week / SEC),
      month: Math.round(month / SEC),
      range: Math.round(rangeSeconds / SEC),
      afk: Math.round(Math.max(0, coverageDuration(raw) - rangeSeconds) / SEC),
      browsing: Math.round(coverageDuration(web) / SEC),
      activeDays,
      averagePerDay: Math.round(rangeSeconds / SEC / Math.max(1, activeDays)),
      switches: countSwitches(active, appKey),
    },
    topApps: rank(groupBy(active, appKey, tolerance)).slice(0, 30),
    topDomains: rank(groupBy(web, (e) => hostFromUrl(e.data.url), tolerance)).slice(0, 30),
    topUrls: rank(
      groupBy(web, (e) => {
        const url = e.data.url;
        if (typeof url !== "string") return null;
        try {
          const parsed = new URL(url);
          const path = parsed.pathname === "/" ? "" : parsed.pathname.slice(0, 48);
          return `${parsed.hostname}${path}`;
        } catch {
          return null;
        }
      }, tolerance)
    ).slice(0, 30),
    topTitles: rank(
      groupBy(
        active.filter((e) => titleOf(e) !== null),
        (e) => `${appKey(e) ?? "—"}  ·  ${titleOf(e)}`,
        tolerance
      )
    ).slice(0, 80),
    heatmap,
    busiestHour,
  };
}

export interface CategoriesPayload {
  range: { from: number; to: number; key: RangeKey };
  totals: { active: number };
  score: number;
  previousScore: number | null;
  split: { productive: number; leisure: number; threshold: number };
  slices: CategorySlice[];
  webSlices: CategorySlice[];
  daily: PeriodEntry[];
  weekly: PeriodEntry[];
}

interface DayBucket {
  from: number;
  to: number;
  events: TimedEvent[];
}

/** Splits events on local midnight so a day's stats never mix with the next. */
function bucketByDay(events: TimedEvent[], to: number): DayBucket[] {
  const buckets = new Map<string, DayBucket>();
  for (const ev of events) {
    let cursor = ev.start;
    while (cursor < ev.end) {
      const dayStart = startOfDay(new Date(cursor)).getTime();
      const dayEnd = Math.min(endOfDay(new Date(cursor)).getTime(), to);
      const sliceEnd = Math.min(dayEnd, ev.end);
      const key = dateKey(new Date(dayStart));
      const bucket = buckets.get(key) ?? { from: dayStart, to: dayEnd, events: [] };
      bucket.events.push({ start: cursor, end: sliceEnd, data: ev.data, origin: ev.origin });
      buckets.set(key, bucket);
      cursor = sliceEnd;
    }
  }
  return [...buckets.values()].sort((a, b) => a.from - b.from);
}

function periodOf(events: TimedEvent[], settings: Settings, from: number, to: number, period: string): PeriodEntry {
  const { slices, total } = categorize(events, settings, from, to);
  const byCategory: Record<string, number> = {};
  for (const slice of slices) byCategory[slice.id] = slice.duration;
  return { period, from, to, active: Math.round(total), score: productivityScore(slices, total), byCategory };
}

function groupBuckets(days: DayBucket[], settings: Settings, keyOf: (ms: number) => string): PeriodEntry[] {
  const groups = new Map<string, DayBucket[]>();
  for (const day of days) {
    const key = keyOf(day.from);
    const list = groups.get(key) ?? [];
    list.push(day);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, list]) => {
      const events = list.flatMap((d) => d.events);
      const from = Math.min(...list.map((d) => d.from));
      const to = Math.max(...list.map((d) => d.to));
      return periodOf(events, settings, from, to, key);
    });
}

export function buildCategories(
  loaded: LoadedActivity,
  settings: Settings,
  range: TimeRange,
  previous: { range: TimeRange; loaded: LoadedActivity } | null
): CategoriesPayload {
  const active = inRange(loaded.active, range.from, range.to);
  const web = inRange(loaded.web, range.from, range.to).filter((e) => hostFromUrl(e.data.url) !== null);

  const main = categorize(active, settings, range.from, range.to);
  const webCategorised = categorize(web, settings, range.from, range.to);
  const { productive, leisure } = splitByWeight(main.slices, settings.productiveThreshold);

  const prevActive = previous ? inRange(previous.loaded.raw, previous.range.from, previous.range.to) : [];
  const previousBlock = prevActive.length > 0 && previous ? categorize(prevActive, settings, previous.range.from, previous.range.to) : null;

  const days = bucketByDay(active, range.to);
  return {
    range: { from: range.from, to: range.to, key: range.key },
    totals: { active: Math.round(main.total) },
    score: productivityScore(main.slices, main.total),
    previousScore: previousBlock ? productivityScore(previousBlock.slices, previousBlock.total) : null,
    split: {
      productive: Math.round(productive),
      leisure: Math.round(leisure),
      threshold: settings.productiveThreshold,
    },
    slices: main.slices,
    webSlices: webCategorised.slices,
    daily: days.map((day) => periodOf(day.events, settings, day.from, day.to, dateKey(new Date(day.from)))),
    weekly: groupBuckets(days, settings, (ms) => dateKey(startOfWeek(new Date(ms)))),
  };
}

export interface Segment {
  start: number;
  end: number;
  duration: number;
  app: string | null;
  title: string | null;
  categoryId: string;
  color: number;
}

export interface TimelinePayload {
  day: string;
  from: number;
  to: number;
  /** Echoed so the UI can explain how sessions and breaks were derived. */
  thresholds: { sessionMinSec: number; breakThresholdSec: number; gapToleranceSec: number };
  totals: { active: number; afk: number; first: number | null; last: number | null; span: number; events: number };
  segments: Segment[];
  sessions: Array<{
    start: number;
    end: number;
    duration: number;
    switches: number;
    focusApp: string;
    focusShare: number;
    categories: Array<{ id: string; duration: number }>;
  }>;
  switches: {
    total: number;
    perHour: number[];
    averageInterval: number;
    topPairs: Array<{ from: string; to: string; count: number }>;
  };
  longestRuns: Array<{ app: string; duration: number; start: number; end: number }>;
  breaks: Array<{ start: number; end: number; duration: number; kind: "micro" | "short" | "long" }>;
  breakSummary: { count: number; total: number; average: number; longest: number };
  hourly: number[];
  /** Browser tab events, in time order, for the web strip. */
  webEvents: Array<{ start: number; end: number; duration: number; url: string | null; title: string | null; host: string | null }>;
  /** Raw afk-status events so the UI can draw away/present bands. */
  afkStates: Array<{ start: number; end: number; duration: number; afk: boolean }>;
}

function breakKind(ms: number): "micro" | "short" | "long" {
  const minutes = ms / MIN;
  return minutes < 10 ? "micro" : minutes < 30 ? "short" : "long";
}

/** Longest uninterrupted stretch inside one app, tolerating sub-`gap` silences. */
function longestRunBounds(events: TimedEvent[], gapMs: number): Interval {
  const sorted = [...events].sort((a, b) => a.start - b.start);
  let best: Interval = { start: sorted[0]?.start ?? 0, end: sorted[0]?.end ?? 0 };
  let run: Interval = { ...best };
  for (const ev of sorted.slice(1)) {
    if (ev.start - run.end <= gapMs) {
      run.end = Math.max(run.end, ev.end);
    } else {
      run = { start: ev.start, end: ev.end };
    }
    if (run.end - run.start > best.end - best.start) best = { ...run };
  }
  return best;
}

export function buildTimeline(loaded: LoadedActivity, settings: Settings, day: Date): TimelinePayload {
  const from = startOfDay(day).getTime();
  const to = endOfDay(day).getTime();
  const active = inRange(loaded.active, from, to);
  const raw = inRange(loaded.raw, from, to);
  const compiled = compileCategories(settings);
  const { slices } = categorize(active, settings, from, to);
  const colorOf = new Map(slices.map((s) => [s.id, s.color]));
  const tolerance = settings.gapToleranceSec * SEC;

  const segments: Segment[] = active.map((ev) => {
    const categoryId = classify(ev, compiled);
    return {
      start: ev.start,
      end: ev.end,
      duration: Math.round((ev.end - ev.start) / SEC),
      app: appKey(ev),
      title: titleOf(ev),
      categoryId,
      color: colorOf.get(categoryId) ?? 18,
    };
  });

  const sessionBlocks = toSessions(active, settings.breakThresholdSec * SEC)
    .map((group) => {
      const start = group[0].start;
      const end = group[group.length - 1].end;
      const byApp = groupBy(group, appKey, tolerance);
      const cat = categorize(group, settings, start, end);
      return {
        start,
        end,
        duration: Math.round((end - start) / SEC),
        switches: countSwitches(group, appKey),
        focusApp: byApp[0]?.key ?? "—",
        focusShare: end > start && byApp[0] ? Math.round((byApp[0].duration / (end - start)) * 100) : 0,
        categories: cat.slices.map((s) => ({ id: s.id, duration: s.duration })),
      };
    })
    .filter((s) => s.duration >= settings.sessionMinSec)
    .sort((a, b) => b.start - a.start);

  const sorted = [...active].sort((a, b) => a.start - b.start);
  const webEvents = inRange(loaded.web, from, to)
    .sort((a, b) => a.start - b.start)
    .map((ev) => ({
      start: ev.start,
      end: ev.end,
      duration: Math.round((ev.end - ev.start) / SEC),
      url: typeof ev.data.url === "string" ? ev.data.url : null,
      title: typeof ev.data.title === "string" ? ev.data.title : null,
      host: hostFromUrl(ev.data.url),
    }));
  const afkStates = inRange(loaded.afk, from, to)
    .sort((a, b) => a.start - b.start)
    .map((ev) => ({
      start: ev.start,
      end: ev.end,
      duration: Math.round((ev.end - ev.start) / SEC),
      afk: ev.data.status === "afk",
    }));
  const perHour = new Array<number>(24).fill(0);
  const pairs = new Map<string, number>();
  let previousApp: string | null = null;
  for (const ev of sorted) {
    const name = appKey(ev);
    if (!name) continue;
    if (previousApp !== null && previousApp !== name) {
      perHour[new Date(ev.start).getHours()] += 1;
      const key = `${previousApp}\u0000${name}`;
      pairs.set(key, (pairs.get(key) ?? 0) + 1);
    }
    previousApp = name;
  }
  const totalSwitches = [...pairs.values()].reduce((a, b) => a + b, 0);
  const spanMs = sorted.length > 1 ? sorted[sorted.length - 1].end - sorted[0].start : 0;

  const longestRuns = groupBy(sorted, appKey, tolerance)
    .slice(0, 15)
    .map((group) => {
      const bounds = longestRunBounds(group.events, tolerance);
      return { app: group.key, duration: Math.round((bounds.end - bounds.start) / SEC), start: bounds.start, end: bounds.end };
    })
    .sort((a, b) => b.duration - a.duration)
    .slice(0, 10);

  const breaks = findBreaks(active, settings.breakThresholdSec * SEC).map((b) => ({
    start: b.start,
    end: b.end,
    duration: Math.round(b.duration / SEC),
    kind: breakKind(b.duration),
  }));

  return {
    day: dateKey(day),
    from,
    to,
    thresholds: {
      sessionMinSec: settings.sessionMinSec,
      breakThresholdSec: settings.breakThresholdSec,
      gapToleranceSec: settings.gapToleranceSec,
    },
    totals: {
      active: Math.round(coverageDuration(active) / SEC),
      afk: Math.round(Math.max(0, sumDuration(raw) - sumDuration(active)) / SEC),
      first: sorted[0]?.start ?? null,
      last: sorted.length > 0 ? sorted[sorted.length - 1].end : null,
      span: Math.round(spanMs / SEC),
      events: sorted.length,
    },
    segments,
    sessions: sessionBlocks,
    switches: {
      total: totalSwitches,
      perHour,
      averageInterval: totalSwitches > 0 ? Math.round(spanMs / SEC / totalSwitches) : 0,
      topPairs: [...pairs.entries()]
        .map(([key, count]) => {
          const [fromApp, toApp] = key.split("\u0000");
          return { from: fromApp, to: toApp, count };
        })
        .sort((a, b) => b.count - a.count)
        .slice(0, 10),
    },
    longestRuns,
    breaks,
    breakSummary: {
      count: breaks.length,
      total: breaks.reduce((a, b) => a + b.duration, 0),
      average: breaks.length ? Math.round(breaks.reduce((a, b) => a + b.duration, 0) / breaks.length) : 0,
      longest: breaks.length ? Math.max(...breaks.map((b) => b.duration)) : 0,
    },
    hourly: intoHeatmap(active).hourly,
    webEvents,
    afkStates,
  };
}

export interface TrendsPayload {
  granularity: "day" | "week" | "month";
  periods: PeriodEntry[];
  current: { from: number; to: number; total: number; average: number; score: number };
  comparison: Array<{ key: "previous" | "lastYear"; from: number; to: number; total: number; score: number | null; deltaPct: number | null }>;
  records: {
    mostActive: PeriodEntry | null;
    leastActive: PeriodEntry | null;
    bestScore: PeriodEntry | null;
    worstScore: PeriodEntry | null;
    periodsWithData: number;
    since: number | null;
  };
  appTrends: Array<{ key: string; series: number[] }>;
}

function pctDelta(current: number, previous: number): number | null {
  // "infinite growth" over an empty baseline is not a useful percentage.
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function summariseRange(loaded: LoadedActivity, settings: Settings, range: TimeRange): { total: number; score: number | null } {
  const events = inRange(loaded.active, range.from, range.to);
  if (events.length === 0) return { total: 0, score: null };
  const { slices, total } = categorize(events, settings, range.from, range.to);
  return { total: Math.round(total), score: productivityScore(slices, total) };
}

export function buildTrends(
  loaded: LoadedActivity,
  settings: Settings,
  range: TimeRange,
  granularity: "day" | "week" | "month",
  comparison: Array<{ key: "previous" | "lastYear"; range: TimeRange; loaded: LoadedActivity | null }>
): TrendsPayload {
  const active = inRange(loaded.active, range.from, range.to);
  const tolerance = settings.gapToleranceSec * SEC;
  const days = bucketByDay(active, range.to);
  const daily = days.map((day) => periodOf(day.events, settings, day.from, day.to, dateKey(new Date(day.from))));

  const periods =
    granularity === "day"
      ? daily
      : granularity === "week"
        ? groupBuckets(days, settings, (ms) => dateKey(startOfWeek(new Date(ms))))
        : groupBuckets(days, settings, (ms) => dateKey(new Date(ms)).slice(0, 7));
  // Range totals come from one pooled pass, the same way the comparison blocks are built.
  const pooled = categorize(active, settings, range.from, range.to);

  const total = Math.round(pooled.total);
  const withData = periods.filter((p) => p.active > 0);
  const byDuration = [...periods].sort((a, b) => b.active - a.active);
  const byScore = [...withData].sort((a, b) => b.score - a.score);
  const blocks = comparison.map(({ key, range: compareRange, loaded: compareLoaded }) => {
    const summary = compareLoaded ? summariseRange(compareLoaded, settings, compareRange) : { total: 0, score: null as number | null };
    return {
      key,
      from: compareRange.from,
      to: compareRange.to,
      total: summary.total,
      score: summary.score,
      deltaPct: pctDelta(total, summary.total),
    };
  });

  const topAppGroups = groupBy(active, appKey, tolerance).slice(0, 6);

  return {
    granularity,
    periods,
    current: {
      from: range.from,
      to: range.to,
      total,
      average: periods.length ? Math.round(total / periods.length) : 0,
      score: productivityScore(pooled.slices, pooled.total),
    },
    comparison: blocks,
    records: {
      mostActive: byDuration[0] ?? null,
      leastActive: withData.length ? [...withData].sort((a, b) => a.active - b.active)[0] : null,
      bestScore: byScore[0] ?? null,
      worstScore: byScore.length ? byScore[byScore.length - 1] : null,
      periodsWithData: withData.length,
      since: loaded.raw[0]?.start ?? null,
    },
    appTrends: topAppGroups.map((group) => ({
      key: group.key,
      series: periods.map((period) => Math.round(coverageDuration(inRange(group.events, period.from, period.to)) / SEC)),
    })),
  };
}

/** Load window that always covers the today / week / month totals. */
export function overviewLoadRange(range: TimeRange, now: Date): { from: number; to: number } {
  return { from: Math.min(range.from, startOfMonth(now).getTime()), to: range.to };
}

export function dayFromParam(value: string | null | undefined, now: Date): Date {
  if (!value) return now;
  const parsed = parseDateKey(value);
  return Number.isNaN(parsed.getTime()) ? now : parsed;
}
