"use client";

import * as React from "react";
import useSWR, { mutate as globalMutate, type SWRConfiguration } from "swr";
import { apiFetch } from "@/lib/client/api";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly hint?: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

const fetcher = async (url: string) => {
  const res = await apiFetch(url);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const payload = (body ?? {}) as { error?: string; code?: string; hint?: string };
    throw new ApiError(payload.error ?? `Request failed: ${res.status}`, res.status, payload.code, payload.hint);
  }
  return body;
};

/** Analytics data refreshes itself so an actively-tracked machine stays current. */
const DEFAULTS: SWRConfiguration = {
  refreshInterval: 60_000,
  revalidateOnFocus: true,
  keepPreviousData: true,
  dedupingInterval: 5_000,
  shouldRetryOnError: false,
};

export function useApi<T>(path: string | null, options: SWRConfiguration = {}) {
  return useSWR<T>(path, fetcher, { ...DEFAULTS, ...options });
}

export function useStatus<T>(enabled = true) {
  return useSWR<T>(enabled ? "/api/status" : null, fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
    shouldRetryOnError: false,
    dedupingInterval: 10_000,
  });
}

/** Clears the event memo and re-requests every mounted query. */
export async function refreshAll() {
  await apiFetch("/api/refresh", { method: "POST" }).catch(() => undefined);
  // The second argument is the optimistic payload, so it must stay undefined or
  // every cache entry gets replaced by the options object.
  await globalMutate(() => true, undefined, { revalidate: true });
}

/** False during SSR and the hydration render, true afterwards. */
export function useMounted(): boolean {
  return React.useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

/** Ticks so "updated 3 minutes ago" labels stay honest. Starts null because
 *  Cache Components rejects a current-time read during prerender. */
export function useNow(intervalMs = 30_000): number | null {
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    // One-shot clock read: the interval below only reports later changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
