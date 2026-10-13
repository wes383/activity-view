import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, readQuery } from "@/lib/api";
import { loadActivity } from "@/lib/aw/client";
import { buildTimeline, dayFromParam } from "@/lib/core/analytics";
import { endOfDay, startOfDay } from "@/lib/core/time";

export async function GET(request: NextRequest) {
  const { settings, now, params } = readQuery(request);
  try {
    const day = dayFromParam(params.get("date"), now);
    const from = startOfDay(day).getTime();
    const to = Math.min(endOfDay(day).getTime(), now.getTime() + 60_000);
    const loaded = await loadActivity(settings.awHost, settings, from, to);
    return NextResponse.json(buildTimeline(loaded, settings, day));
  } catch (err) {
    return errorResponse(err);
  }
}
