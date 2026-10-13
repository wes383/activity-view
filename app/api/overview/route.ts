import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, readQuery } from "@/lib/api";
import { loadActivity } from "@/lib/aw/client";
import { buildOverview, overviewLoadRange } from "@/lib/core/analytics";

export async function GET(request: NextRequest) {
  const { settings, now, range } = readQuery(request);
  try {
    // Today / this week / this month are always shown, so the load window has to
    // reach back to the start of the month even for a "today" view.
    const load = overviewLoadRange(range, now);
    const loaded = await loadActivity(settings.awHost, settings, load.from, load.to);
    return NextResponse.json(buildOverview(loaded, settings, range, now));
  } catch (err) {
    return errorResponse(err);
  }
}
