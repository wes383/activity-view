import type { AWBucket, AWEvent, AWInfo, DiscoveredBuckets, TimedEvent } from "@/lib/aw/types";
import { httpFetch } from "@/lib/client/http";
import type { Settings } from "@/lib/core/settings";
import { daySlices, isPastDay, startOfDay } from "@/lib/core/time";
import { subtractIntervals, toTimedEvents } from "@/lib/core/intervals";

const PAST_TTL_MS = 30 * 60 * 1000;
const LIVE_TTL_MS = 5_000;
const MAX_CACHED_DAYS = 240;
const FETCH_CONCURRENCY = 8;

interface CacheEntry {
  expires: number;
  events: AWEvent[];
}

/**
 * Day-aligned memo of raw events. ActivityWatch is append-mostly, so a closed
 * day never changes and can be held for a long time; today is refetched often.
 */
const dayCache = new Map<string, CacheEntry>();

function cacheGet(key: string): AWEvent[] | null {
  const hit = dayCache.get(key);
  if (!hit) return null;
  if (hit.expires <= Date.now()) {
    dayCache.delete(key);
    return null;
  }
  // Refresh recency for the LRU eviction below.
  dayCache.delete(key);
  dayCache.set(key, hit);
  return hit.events;
}

function cacheSet(key: string, events: AWEvent[], ttl: number) {
  dayCache.set(key, { expires: Date.now() + ttl, events });
  if (dayCache.size > MAX_CACHED_DAYS) {
    const oldest = dayCache.keys().next().value;
    if (oldest !== undefined) dayCache.delete(oldest);
  }
}

export async function awFetch<T>(host: string, path: string, init?: RequestInit): Promise<T> {
  const url = `${host.replace(/\/+$/, "")}/api/0/${path.replace(/^\/+/, "")}`;
  const res = await httpFetch(url, init);
  if (!res.ok) {
    throw new ActivityWatchError(`ActivityWatch ${res.status} for ${url}`, res.status);
  }
  return (await res.json()) as T;
}

export class ActivityWatchError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ActivityWatchError";
  }
}

/** Drops the memoised day slices so a manual refresh re-reads the server. */
export function clearEventCache() {
  dayCache.clear();
}

export function getInfo(host: string): Promise<AWInfo> {
  return awFetch<AWInfo>(host, "info");
}

export function getBuckets(host: string): Promise<Record<string, AWBucket>> {
  return awFetch<Record<string, AWBucket>>(host, "buckets/");
}

const TYPE_BY_KIND: Record<string, keyof DiscoveredBuckets> = {
  currentwindow: "window",
  afkstatus: "afk",
  "web.tab.current": "web",
  "web.history": "web",
  "web.visits": "web",
};

/**
 * Picks one bucket per watcher client, preferring the one whose hostname
 * matches, so duplicated "unknown"-hostname buckets are not double-counted.
 */
export function discoverBuckets(buckets: AWBucket[], hostname: string | null): DiscoveredBuckets {
  const byKind: DiscoveredBuckets = { window: [], afk: [], web: [] };
  const newestByClient = new Map<string, { bucket: AWBucket; kind: keyof DiscoveredBuckets }>();

  for (const bucket of buckets) {
    const kind = TYPE_BY_KIND[bucket.type];
    if (!kind) continue;
    if (hostname && bucket.hostname !== hostname && bucket.hostname !== "unknown") continue;
    const prev = newestByClient.get(bucket.client);
    const stamp = Date.parse(bucket.last_updated ?? bucket.created ?? "") || 0;
    const prevStamp = prev ? Date.parse(prev.bucket.last_updated ?? prev.bucket.created ?? "") || 0 : -1;
    if (!prev || stamp >= prevStamp) newestByClient.set(bucket.client, { bucket, kind });
  }

  for (const { bucket, kind } of newestByClient.values()) {
    byKind[kind].push(bucket.id);
  }
  return byKind;
}

async function fetchRange(host: string, bucketId: string, from: number, to: number): Promise<AWEvent[]> {
  const start = new Date(from).toISOString();
  const end = new Date(to).toISOString();
  const params = new URLSearchParams({ start, end, limit: "-1" });
  return awFetch<AWEvent[]>(host, `buckets/${encodeURIComponent(bucketId)}/events?${params}`);
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      out[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Fetches events for a range, split into day-aligned slices so closed days can
 * be memoised and the remote never has to serialise a huge payload at once.
 */
export async function fetchEvents(host: string, bucketId: string, from: number, to: number): Promise<AWEvent[]> {
  const slices = daySlices(from, to);
  if (slices.length === 0) return [];
  if (slices.length === 1 && !isPastDay(slices[0][0])) return fetchRange(host, bucketId, from, to);

  const chunks = await mapLimit(slices, FETCH_CONCURRENCY, async ([s, e]) => {
    const key = `${bucketId}:${s}:${e}`;
    const cached = cacheGet(key);
    if (cached) return cached;
    const events = await fetchRange(host, bucketId, s, e);
    cacheSet(key, events, isPastDay(s) ? PAST_TTL_MS : LIVE_TTL_MS);
    return events;
  });
  return chunks.flat();
}

export function hostFromUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase();
  } catch {
    return null;
  }
}

export interface LoadedActivity {
  /** Window activity with AFK time removed (when the setting is on). */
  active: TimedEvent[];
  /** Window activity before AFK removal. */
  raw: TimedEvent[];
  afk: TimedEvent[];
  web: TimedEvent[];
  buckets: DiscoveredBuckets;
  hostname: string;
  range: { from: number; to: number };
}

export async function loadActivity(host: string, settings: Settings, from: number, to: number): Promise<LoadedActivity> {
  const info = await getInfo(host);
  const hostname = settings.hostname ?? info.hostname;
  const list = await getBuckets(host);
  const buckets = discoverBuckets(Object.values(list), hostname);

  const collect = async (ids: string[]) =>
    (await Promise.all(ids.map((id) => fetchEvents(host, id, from, to))))
      .map((events, i) => toTimedEvents(events, from, to, ids[i]))
      .flat();

  const [rawWindow, afkAll, web] = await Promise.all([
    collect(buckets.window),
    collect(buckets.afk),
    collect(buckets.web),
  ]);

  const minMs = settings.minEventSec * 1000;
  const raw = rawWindow.filter((e) => e.end - e.start >= minMs);
  const afkEvents = afkAll.filter((e) => e.data.status === "afk");

  const active = settings.excludeAfk ? subtractIntervals(raw, afkEvents, from, to) : raw;

  return { active, raw, afk: afkAll, web, buckets, hostname, range: { from, to } };
}

/**
 * Reuses an already-loaded window when it covers the requested range, so
 * comparison periods do not trigger a second round trip.
 */
export async function loadActivityCovering(
  host: string,
  settings: Settings,
  from: number,
  to: number,
  existing: LoadedActivity
): Promise<LoadedActivity> {
  if (existing.range.from <= from && existing.range.to >= to) return existing;
  return loadActivity(host, settings, from, to);
}

export interface ServerStatus {
  ok: boolean;
  host: string;
  error?: string;
  version?: string;
  hostname?: string;
  deviceName?: string;
  watchers: Array<{ kind: string; bucketId: string; client: string; lastUpdated: number | null }>;
  /** Timestamp of the newest window event the server knows about. */
  latestEvent: number | null;
}

export async function checkStatus(settings: Settings): Promise<ServerStatus> {
  const host = settings.awHost;
  try {
    const info = await getInfo(host);
    const buckets = await getBuckets(host);
    const list = Object.values(buckets);
    const discovered = discoverBuckets(list, settings.hostname ?? info.hostname);
    const watchers: ServerStatus["watchers"] = [];
    for (const kind of ["window", "afk", "web"] as const) {
      for (const id of discovered[kind]) {
        watchers.push({
          kind,
          bucketId: id,
          client: buckets[id]?.client ?? "",
          lastUpdated: Date.parse(buckets[id]?.last_updated ?? "") || null,
        });
      }
    }

    const dayAgo = Date.now() - 86_400_000;
    const recent = await Promise.all(
      discovered.window.map((id) => fetchEvents(host, id, dayAgo, Date.now()))
    );
    const stamps = recent.flat().map((e) => Date.parse(e.timestamp) + (e.duration || 0) * 1000);
    const latestEvent = stamps.length > 0 ? Math.max(...stamps) : null;

    return { ok: true, host, version: info.version, hostname: info.hostname, deviceName: info.hostname, watchers, latestEvent };
  } catch (err) {
    return {
      ok: false,
      host,
      error: err instanceof Error ? err.message : String(err),
      watchers: [],
      latestEvent: null,
    };
  }
}

/** Oldest date the server holds window data for, used to bound trend charts. */
export async function earliestData(host: string, settings: Settings): Promise<number | null> {
  const info = await getInfo(host).catch(() => null);
  const hostname = settings.hostname ?? info?.hostname ?? null;
  if (!hostname) return null;
  const list = Object.values(await getBuckets(host));
  const windowIds = discoverBuckets(list, hostname).window;
  if (windowIds.length === 0) return null;
  let created = Infinity;
  for (const id of windowIds) {
    const stamp = Date.parse(list.find((b) => b.id === id)?.created ?? "");
    if (!Number.isNaN(stamp)) created = Math.min(created, stamp);
  }
  return Number.isFinite(created) ? created : null;
}

/** Local-time first instant of `days` ago, used as a scan floor. */
export function floorDay(days: number): number {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return startOfDay(d).getTime();
}
