import { NextResponse, type NextRequest } from "next/server";
import { errorResponse, readQuery } from "@/lib/api";
import { loadActivity, loadActivityCovering } from "@/lib/aw/client";
import { buildCategories } from "@/lib/core/analytics";
import { loadSettings, sanitizeSettings, saveSettings, type Category, type RuleField } from "@/lib/core/settings";
import { previousRange } from "@/lib/core/time";

export async function GET(request: NextRequest) {
  const { settings, range } = readQuery(request);
  try {
    const loaded = await loadActivity(settings.awHost, settings, range.from, range.to);

    // The previous-period comparison needs its own window unless the main load
    // already covers it.
    const previous = previousRange(range);
    const covering =
      loaded.range.from <= previous.from && loaded.range.to >= previous.to
        ? loaded
        : await loadActivityCovering(settings.awHost, settings, previous.from, previous.to, loaded);

    return NextResponse.json(
      buildCategories(loaded, settings, range, { range: previous, loaded: covering })
    );
  } catch (err) {
    return errorResponse(err);
  }
}

/**
 * Quick assignment from the categories page: append one substring rule for an
 * otherwise unmatched app or host to an existing category. Updating the file
 * server-side keeps the persisted object consistent instead of round-tripping
 * it through a possibly stale client copy.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const raw = (body ?? {}) as Record<string, unknown>;
  const pattern = typeof raw.key === "string" ? raw.key.trim().slice(0, 200) : "";
  const field: RuleField = raw.kind === "domain" ? "domain" : "app";
  const categoryId = typeof raw.categoryId === "string" ? raw.categoryId : "";

  if (!pattern) return NextResponse.json({ error: "Missing key" }, { status: 400 });
  if (!categoryId) return NextResponse.json({ error: "Missing categoryId" }, { status: 400 });

  try {
    const settings = loadSettings();
    if (!settings.categories.some((category) => category.id === categoryId)) {
      return NextResponse.json({ error: "Unknown category" }, { status: 404 });
    }

    const saved = saveSettings(
      sanitizeSettings({
        ...settings,
        categories: settings.categories.map((category) =>
          category.id === categoryId ? withRule(category, field, pattern) : category
        ),
      })
    );
    return NextResponse.json({ ok: true, categoryId, settings: saved });
  } catch (err) {
    return errorResponse(err);
  }
}

function withRule(category: Category, field: RuleField, pattern: string): Category {
  const already = category.conditions.some(
    (condition) => condition.field === field && condition.pattern === pattern && !condition.regex
  );
  if (already) return category;
  // A category the user switched off cannot receive the activity, so it is re-enabled.
  return { ...category, enabled: true, conditions: [...category.conditions, { field, pattern, regex: false }] };
}
