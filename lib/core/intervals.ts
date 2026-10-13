import type { AWEvent, TimedEvent } from "@/lib/aw/types";

export interface Interval {
  start: number;
  end: number;
}

const MINUTE = 60 * 1000;

/**
 * Converts raw ActivityWatch events into absolute, range-clipped intervals.
 * A zero-duration event (an instant) is expanded to a 1s floor so that
 * heartbeat-style events still register.
 */
export function toTimedEvents(events: AWEvent[], from: number, to: number, origin?: string): TimedEvent[] {
  const out: TimedEvent[] = [];
  for (const e of events) {
    const start = Date.parse(e.timestamp);
    if (Number.isNaN(start)) continue;
    const dur = Math.max(0, Number(e.duration) || 0) * 1000;
    const rawEnd = start + dur;
    const end = rawEnd <= start ? start + 1000 : rawEnd;
    const clippedStart = Math.max(start, from);
    const clippedEnd = Math.min(end, to);
    if (clippedEnd <= clippedStart) continue;
    out.push({ start: clippedStart, end: clippedEnd, data: e.data ?? {}, origin });
  }
  return out.sort((a, b) => a.start - b.start);
}

export function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = [...list].sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const iv of sorted) {
    const last = out[out.length - 1];
    if (last && iv.start <= last.end) {
      if (iv.end > last.end) last.end = iv.end;
    } else {
      out.push({ ...iv });
    }
  }
  return out;
}

/** Complement of `covered` inside [from, to]. */
export function invertIntervals(covered: Interval[], from: number, to: number): Interval[] {
  const merged = mergeIntervals(covered);
  const out: Interval[] = [];
  let cursor = from;
  for (const iv of merged) {
    const s = Math.max(iv.start, from);
    const e = Math.min(iv.end, to);
    if (e <= cursor) continue;
    if (s > cursor) out.push({ start: cursor, end: Math.min(s, to) });
    cursor = Math.max(cursor, e);
    if (cursor >= to) break;
  }
  if (cursor < to) out.push({ start: cursor, end: to });
  return out;
}

/** Keeps only the part of each event that falls inside `intervals` (merged & sorted). */
export function clipToIntervals(events: TimedEvent[], intervals: Interval[], minDurationMs = 0): TimedEvent[] {
  const merged = mergeIntervals(intervals);
  const out: TimedEvent[] = [];
  for (const ev of events) {
    let lo = 0;
    let hi = merged.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (merged[mid].end <= ev.start) lo = mid + 1;
      else hi = mid;
    }
    for (let j = lo; j < merged.length && merged[j].start < ev.end; j++) {
      const iv = merged[j];
      const start = Math.max(ev.start, iv.start);
      const end = Math.min(ev.end, iv.end);
      if (end > start && end - start >= minDurationMs) out.push({ start, end, data: ev.data, origin: ev.origin });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

/** AW `not_intersect`: drop every millisecond of `events` covered by `removes`. */
export function subtractIntervals(events: TimedEvent[], removes: TimedEvent[], from: number, to: number): TimedEvent[] {
  const keep = invertIntervals(removes, from, to);
  return clipToIntervals(events, keep);
}

export function coverageDuration(intervals: Interval[]): number {
  return mergeIntervals(intervals).reduce((acc, iv) => acc + (iv.end - iv.start), 0);
}

export function sumDuration(events: Array<{ start: number; end: number }>): number {
  return events.reduce((acc, e) => acc + (e.end - e.start), 0);
}

export interface GroupedStats {
  key: string;
  /** Wall-clock time on this key, overlapping events counted once. */
  duration: number;
  /** Number of distinct events (usage occasions). */
  occurrences: number;
  events: TimedEvent[];
  firstSeen: number;
  lastSeen: number;
  /** Longest single uninterrupted stretch, after tolerating small gaps. */
  longestRun: number;
}

/**
 * Groups events by a derived key and unions their intervals, so time is never
 * double-counted when the same app reports overlapping heartbeat events.
 */
export function groupBy(events: TimedEvent[], keyOf: (e: TimedEvent) => string | null, gapToleranceMs = 0): GroupedStats[] {
  const buckets = new Map<string, TimedEvent[]>();
  for (const ev of events) {
    const key = keyOf(ev);
    if (!key) continue;
    const list = buckets.get(key);
    if (list) list.push(ev);
    else buckets.set(key, [ev]);
  }

  const out: GroupedStats[] = [];
  for (const [key, list] of buckets) {
    const sorted = list.sort((a, b) => a.start - b.start);
    out.push({
      key,
      duration: coverageDuration(sorted),
      occurrences: sorted.length,
      events: sorted,
      firstSeen: sorted[0].start,
      lastSeen: sorted[sorted.length - 1].end,
      longestRun: longestRun(sorted, gapToleranceMs),
    });
  }
  return out.sort((a, b) => b.duration - a.duration);
}

/** Longest chain of same-key events separated by no more than `gapToleranceMs`. */
export function longestRun(events: Array<{ start: number; end: number }>, gapToleranceMs = 0): number {
  if (events.length === 0) return 0;
  const sorted = [...events].sort((a, b) => a.start - b.start);
  let best = 0;
  let runStart = sorted[0].start;
  let runEnd = sorted[0].end;
  for (let i = 1; i < sorted.length; i++) {
    const ev = sorted[i];
    if (ev.start - runEnd <= gapToleranceMs) {
      runEnd = Math.max(runEnd, ev.end);
    } else {
      best = Math.max(best, runEnd - runStart);
      runStart = ev.start;
      runEnd = ev.end;
    }
  }
  return Math.max(best, runEnd - runStart);
}

/** Contiguous blocks of activity, split wherever the gap exceeds `breakMs`. */
export function toSessions(events: TimedEvent[], breakMs: number): TimedEvent[][] {
  const sorted = [...events].sort((a, b) => a.start - b.start);
  const out: TimedEvent[][] = [];
  let current: TimedEvent[] = [];
  for (const ev of sorted) {
    if (current.length > 0 && ev.start - current[current.length - 1].end > breakMs) {
      out.push(current);
      current = [];
    }
    current.push(ev);
  }
  if (current.length > 0) out.push(current);
  return out;
}

export interface BreakGap {
  start: number;
  end: number;
  duration: number;
}

/** Idle gaps between activity, longest first. */
export function findBreaks(events: TimedEvent[], minBreakMs: number): BreakGap[] {
  const merged = mergeIntervals(events);
  const out: BreakGap[] = [];
  for (let i = 1; i < merged.length; i++) {
    const start = merged[i - 1].end;
    const end = merged[i].start;
    if (end - start >= minBreakMs) out.push({ start, end, duration: end - start });
  }
  return out.sort((a, b) => b.duration - a.duration);
}

/** Number of times the displayed key changed, ignoring repeats of the same key. */
export function countSwitches(events: TimedEvent[], keyOf: (e: TimedEvent) => string | null): number {
  const sorted = [...events].sort((a, b) => a.start - b.start);
  let switches = 0;
  let prev: string | null = null;
  for (const ev of sorted) {
    const key = keyOf(ev);
    if (!key) continue;
    if (prev !== null && key !== prev) switches++;
    prev = key;
  }
  return switches;
}

/** Splits one long stretch of activity into `chunkMinutes` blocks. */
export function chunkEvents(events: TimedEvent[], chunkMinutes = 5): TimedEvent[] {
  const chunkMs = chunkMinutes * MINUTE;
  const out: TimedEvent[] = [];
  for (const ev of events) {
    let cursor = ev.start;
    while (cursor < ev.end) {
      const boundary = Math.min(ev.end, Math.floor(cursor / chunkMs) * chunkMs + chunkMs);
      out.push({ start: cursor, end: boundary, data: ev.data, origin: ev.origin });
      cursor = boundary;
    }
  }
  return out;
}
