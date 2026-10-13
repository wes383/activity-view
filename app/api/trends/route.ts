import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, readQuery } from "@/lib/api";
import { loadActivity, type LoadedActivity } from "@/lib/aw/client";
import { buildTrends } from "@/lib/core/analytics";
import { lastYearRange, previousRange, type TimeRange } from "@/lib/core/time";

const MAX_COMPARISON_SPAN_DAYS = 120;

export async function GET(request: NextRequest) {
  const { settings, range, params } = readQuery(request);
  const granularity = (params.get("granularity") ?? "day") as "day" | "week" | "month";

  try {
    const loaded = await loadActivity(settings.awHost, settings, range.from, range.to);

    const previous = previousRange(range);
    const lastYear = lastYearRange(range);
    const comparisons: Array<{ key: "previous" | "lastYear"; range: TimeRange; loaded: LoadedActivity | null }> = [];

    comparisons.push({ key: "previous", range: previous, loaded: await cover(settings.awHost, settings, previous, loaded) });
    // Looking back a full year on top of a year-long range means 24 months of
    // raw events; skip it rather than stall the request.
    if (range.days <= MAX_COMPARISON_SPAN_DAYS) {
      comparisons.push({ key: "lastYear", range: lastYear, loaded: await cover(settings.awHost, settings, lastYear, loaded) });
    } else {
      comparisons.push({ key: "lastYear", range: lastYear, loaded: null });
    }

    return NextResponse.json(buildTrends(loaded, settings, range, granularity, comparisons));
  } catch (err) {
    return errorResponse(err);
  }
}

async function cover(host: string, settings: Parameters<typeof loadActivity>[1], range: TimeRange, existing: LoadedActivity) {
  const span = range.to - range.from;
  if (span <= 0) return null;
  if (existing.range.from <= range.from && existing.range.to >= range.to) return existing;
  // Never fetch more than a quarter of raw events for a comparison block.
  if (range.days > MAX_COMPARISON_SPAN_DAYS) return null;
  return loadActivity(host, settings, range.from, range.to);
}
