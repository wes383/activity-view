import { loadSettings } from "@/lib/client/settings-store";
import type { Settings } from "@/lib/core/settings";
import { resolveRange, type RangeKey } from "@/lib/core/time";

/** Shared query parsing for the analytics handlers. */
export interface Query {
  settings: Settings;
  now: Date;
  range: ReturnType<typeof resolveRange>;
  params: URLSearchParams;
}

export async function readQuery(params: URLSearchParams): Promise<Query> {
  const settings = await loadSettings();
  const now = new Date();
  const range = resolveRange(
    (params.get("range") ?? "today") as RangeKey,
    now,
    params.get("from") ?? undefined,
    params.get("to") ?? undefined
  );
  return { settings, now, range, params };
}

/**
 * A watcher that is not running reports through a dozen different messages
 * depending on whether the request came from the browser stack or from reqwest
 * on the Rust side, so both vocabularies are matched here.
 */
export function isUnreachable(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const cause = (err as { cause?: { code?: string } }).cause?.code;
  const name = err instanceof Error ? err.name : "";
  if (cause === "ECONNREFUSED" || cause === "UND_ERR_CONNECT_TIMEOUT") return true;
  if (name === "TimeoutError" || name === "AbortError") return true;
  return /fetch failed|ECONNREFUSED|connection refused|actively refused|error trying to connect|timed out|timeout|os error 10061/i.test(
    message
  );
}

export const UNREACHABLE_HINT =
  "Start ActivityWatch, or point the dashboard at another address in Settings.";
