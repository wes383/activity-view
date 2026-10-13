/**
 * ActivityWatch REST types.
 * Shapes follow https://docs.activitywatch.net/en/latest/api/rest.html
 */

export interface AWInfo {
  hostname: string;
  version: string;
  testing: boolean;
  device_id?: string;
  profile?: string;
}

export interface AWBucket {
  id: string;
  type: string;
  client: string;
  hostname: string;
  created?: string;
  last_updated?: string;
  data?: Record<string, unknown>;
}

/** Raw event as returned by GET /api/0/buckets/<id>/events */
export interface AWEvent {
  id?: number;
  timestamp: string;
  duration: number;
  data: Record<string, unknown>;
}

/** Event converted to absolute millisecond bounds, clipped to the queried range. */
export interface TimedEvent {
  start: number;
  end: number;
  data: Record<string, unknown>;
  origin?: string;
}

export interface DiscoveredBuckets {
  window: string[];
  afk: string[];
  web: string[];
}
