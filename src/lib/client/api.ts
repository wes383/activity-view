import { checkStatus, clearEventCache, loadActivity, loadActivityCovering, type LoadedActivity } from "@/lib/aw/client";
import { isUnreachable, readQuery, UNREACHABLE_HINT } from "@/lib/client/query";
import { loadSettings, saveSettings, settingsPersisted } from "@/lib/client/settings-store";
import {
  buildCategories,
  buildOverview,
  buildTimeline,
  buildTrends,
  dayFromParam,
  overviewLoadRange,
} from "@/lib/core/analytics";
import { DEFAULT_SETTINGS, sanitizeSettings, type Category, type RuleField } from "@/lib/core/settings";
import { endOfDay, lastYearRange, previousRange, startOfDay, type TimeRange } from "@/lib/core/time";

/**
 * The dashboard used to call seven Next.js route handlers. Inside Tauri there
 * is no server, so the same handlers live here and are dispatched by path.
 * Callers keep using `/api/...` strings, which is why no page had to change.
 */

interface Ctx {
  params: URLSearchParams;
  body?: unknown;
}

interface Result {
  status?: number;
  body: unknown;
}

type Method = "GET" | "POST" | "PUT";
type Handler = (ctx: Ctx) => Promise<Result>;

const MAX_COMPARISON_SPAN_DAYS = 120;

const routes: Record<string, Partial<Record<Method, Handler>>> = {
  "/api/overview": {
    GET: async ({ params }) => {
      const { settings, now, range } = await readQuery(params);
      // Today / this week / this month are always shown, so the load window has
      // to reach back to the start of the month even for a "today" view.
      const load = overviewLoadRange(range, now);
      const loaded = await loadActivity(settings.awHost, settings, load.from, load.to);
      return { body: buildOverview(loaded, settings, range, now) };
    },
  },

  "/api/categories": {
    GET: async ({ params }) => {
      const { settings, range } = await readQuery(params);
      const loaded = await loadActivity(settings.awHost, settings, range.from, range.to);

      // The previous-period comparison needs its own window unless the main
      // load already covers it.
      const previous = previousRange(range);
      const covering =
        loaded.range.from <= previous.from && loaded.range.to >= previous.to
          ? loaded
          : await loadActivityCovering(settings.awHost, settings, previous.from, previous.to, loaded);

      return { body: buildCategories(loaded, settings, range, { range: previous, loaded: covering }) };
    },

    POST: async ({ body }) => {
      const raw = (body ?? {}) as Record<string, unknown>;
      const pattern = typeof raw.key === "string" ? raw.key.trim().slice(0, 200) : "";
      const field: RuleField = raw.kind === "domain" ? "domain" : "app";
      const categoryId = typeof raw.categoryId === "string" ? raw.categoryId : "";

      if (!pattern) return { status: 400, body: { error: "Missing key" } };
      if (!categoryId) return { status: 400, body: { error: "Missing categoryId" } };

      const settings = await loadSettings();
      if (!settings.categories.some((category) => category.id === categoryId)) {
        return { status: 404, body: { error: "Unknown category" } };
      }

      // Appending the rule to the stored object keeps the file consistent
      // instead of round-tripping a possibly stale client copy.
      const saved = await saveSettings({
        ...settings,
        categories: settings.categories.map((category) =>
          category.id === categoryId ? withRule(category, field, pattern) : category
        ),
      });
      return { body: { ok: true, categoryId, settings: saved } };
    },
  },

  "/api/settings": {
    GET: async () => ({
      body: {
        settings: await loadSettings(),
        persisted: await settingsPersisted(),
        defaults: DEFAULT_SETTINGS,
      },
    }),
    PUT: async ({ body }) => {
      const next = await saveSettings(sanitizeSettings(body));
      return { body: { settings: next, persisted: true } };
    },
  },

  "/api/status": {
    GET: async () => {
      const settings = await loadSettings();
      const status = await checkStatus(settings);
      return {
        body: {
          ...status,
          persistedSettings: await settingsPersisted(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      };
    },
  },

  "/api/refresh": {
    POST: async () => {
      clearEventCache();
      return { body: { ok: true } };
    },
  },

  "/api/timeline": {
    GET: async ({ params }) => {
      const { settings, now, params: query } = await readQuery(params);
      const day = dayFromParam(query.get("date"), now);
      const from = startOfDay(day).getTime();
      const to = Math.min(endOfDay(day).getTime(), now.getTime() + 60_000);
      const loaded = await loadActivity(settings.awHost, settings, from, to);
      return { body: buildTimeline(loaded, settings, day) };
    },
  },

  "/api/trends": {
    GET: async ({ params }) => {
      const { settings, range } = await readQuery(params);
      const granularity = (params.get("granularity") ?? "day") as "day" | "week" | "month";

      const loaded = await loadActivity(settings.awHost, settings, range.from, range.to);

      const previous = previousRange(range);
      const lastYear = lastYearRange(range);
      const comparisons: Array<{ key: "previous" | "lastYear"; range: TimeRange; loaded: LoadedActivity | null }> = [];

      comparisons.push({
        key: "previous",
        range: previous,
        loaded: await cover(settings.awHost, settings, previous, loaded),
      });
      // Looking back a full year on top of a year-long range means 24 months of
      // raw events; skip it rather than stall the request.
      comparisons.push({
        key: "lastYear",
        range: lastYear,
        loaded:
          range.days <= MAX_COMPARISON_SPAN_DAYS
            ? await cover(settings.awHost, settings, lastYear, loaded)
            : null,
      });

      return { body: buildTrends(loaded, settings, range, granularity, comparisons) };
    },
  },
};

function withRule(category: Category, field: RuleField, pattern: string): Category {
  const already = category.conditions.some(
    (condition) => condition.field === field && condition.pattern === pattern && !condition.regex
  );
  if (already) return category;
  // A category the user switched off cannot receive the activity, so it is re-enabled.
  return { ...category, enabled: true, conditions: [...category.conditions, { field, pattern, regex: false }] };
}

async function cover(
  host: string,
  settings: Parameters<typeof loadActivity>[1],
  range: TimeRange,
  existing: LoadedActivity
): Promise<LoadedActivity | null> {
  const span = range.to - range.from;
  if (span <= 0) return null;
  if (existing.range.from <= range.from && existing.range.to >= range.to) return existing;
  // Never fetch more than a quarter of raw events for a comparison block.
  if (range.days > MAX_COMPARISON_SPAN_DAYS) return null;
  return loadActivity(host, settings, range.from, range.to);
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * Drop-in replacement for `fetch` on `/api/...` paths. Anything else is passed
 * through untouched, so this stays safe to use as a general helper.
 */
export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? "GET").toUpperCase() as Method;
  const [pathname, search = ""] = path.split("?");
  const handler = routes[pathname]?.[method];

  if (!handler) {
    if (!pathname.startsWith("/api/")) return fetch(path, init);
    return json({ error: `No handler for ${method} ${pathname}` }, 404);
  }

  let body: unknown;
  if (typeof init.body === "string" && init.body.length > 0) {
    try {
      body = JSON.parse(init.body);
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }
  }

  try {
    const result = await handler({ params: new URLSearchParams(search), body });
    return json(result.body, result.status ?? 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const unreachable = isUnreachable(err);
    return json(
      {
        error: message,
        code: unreachable ? "aw_unreachable" : "aw_error",
        hint: unreachable ? UNREACHABLE_HINT : undefined,
      },
      unreachable ? 502 : 500
    );
  }
}
