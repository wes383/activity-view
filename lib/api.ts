import { NextResponse, type NextRequest } from "next/server";
import type { RangeKey } from "@/lib/core/time";
import { resolveRange } from "@/lib/core/time";
import { loadSettings, type Settings } from "@/lib/core/settings";

/** Shared query parsing for the analytics routes. */
export interface Query {
  settings: Settings;
  now: Date;
  range: ReturnType<typeof resolveRange>;
  params: URLSearchParams;
}

export function readQuery(request: NextRequest): Query {
  const params = request.nextUrl.searchParams;
  const settings = loadSettings();
  const now = new Date();
  const range = resolveRange(
    (params.get("range") ?? "today") as RangeKey,
    now,
    params.get("from") ?? undefined,
    params.get("to") ?? undefined
  );
  return { settings, now, range, params };
}

/** Maps a failed ActivityWatch call to a status the UI can explain. */
export function errorResponse(err: unknown): NextResponse {
  const message = err instanceof Error ? err.message : String(err);
  const cause = (err as { cause?: { code?: string } }).cause?.code;
  const name = err instanceof Error ? err.name : "";
  const unreachable =
    cause === "ECONNREFUSED" ||
    cause === "UND_ERR_CONNECT_TIMEOUT" ||
    cause === "TimeoutError" ||
    name === "TimeoutError" ||
    /fetch failed|ECONNREFUSED/i.test(message);

  return NextResponse.json(
    {
      error: message,
      code: unreachable ? "aw_unreachable" : "aw_error",
      hint: unreachable
        ? "Start ActivityWatch, or point the dashboard at another address in Settings."
        : undefined,
    },
    { status: unreachable ? 502 : 500 }
  );
}
