import type { TimedEvent } from "@/lib/aw/types";
import { hostFromUrl } from "@/lib/aw/client";
import { clipToIntervals, coverageDuration, groupBy, invertIntervals, mergeIntervals, type Interval } from "@/lib/core/intervals";
import type { Category, RuleCondition, Settings } from "@/lib/core/settings";

export const UNCATEGORIZED = "__uncategorized__";

interface MatchTarget {
  app: string;
  title: string;
  domain: string;
  url: string;
}

interface CompiledRule {
  field: RuleCondition["field"];
  test: (target: MatchTarget) => boolean;
  raw: string;
  regex: boolean;
}

export interface CompiledCategory {
  id: string;
  label: { zh: string; en: string };
  weight: number;
  color: number;
  rules: CompiledRule[];
}

function buildTest(rule: RuleCondition): (target: MatchTarget) => boolean {
  if (rule.regex) {
    let re: RegExp | null = null;
    try {
      re = new RegExp(rule.pattern, "i");
    } catch {
      re = null; // a half-typed pattern in the settings UI must not break the API
    }
    if (!re) return () => false;
    const value = (target: MatchTarget) =>
      rule.field === "app"
        ? target.app
        : rule.field === "title"
          ? target.title
          : rule.field === "domain"
            ? `${target.domain} ${target.url}`
            : `${target.app} ${target.title} ${target.domain} ${target.url}`;
    return (target) => re!.test(value(target));
  }

  const needle = rule.pattern.toLowerCase();
  return (target) => {
    const hay =
      rule.field === "app"
        ? target.app
        : rule.field === "title"
          ? target.title
          : rule.field === "domain"
            ? `${target.domain} ${target.url}`
            : `${target.app} ${target.title} ${target.domain} ${target.url}`;
    return hay.toLowerCase().includes(needle);
  };
}

export function compileCategories(settings: Settings): CompiledCategory[] {
  return settings.categories
    .filter((c: Category) => c.enabled)
    .map((c) => ({
      id: c.id,
      label: c.label,
      weight: c.weight,
      color: c.color,
      rules: c.conditions.map((rule) => ({
        field: rule.field,
        raw: rule.pattern,
        regex: !!rule.regex,
        test: buildTest(rule),
      })),
    }));
}

function targetOf(event: TimedEvent): MatchTarget {
  const app = typeof event.data.app === "string" ? event.data.app : "";
  const title = typeof event.data.title === "string" ? event.data.title : "";
  const url = typeof event.data.url === "string" ? event.data.url : "";
  return { app, title, url, domain: url ? (hostFromUrl(url) ?? "") : "" };
}

/** First matching category wins, so rule order in settings is rule priority. */
export function classify(event: TimedEvent, compiled: CompiledCategory[]): string {
  const target = targetOf(event);
  for (const category of compiled) {
    for (const rule of category.rules) {
      if (rule.test(target)) return category.id;
    }
  }
  return UNCATEGORIZED;
}

export interface CategorySlice {
  id: string;
  label: { zh: string; en: string };
  weight: number;
  color: number;
  /** Seconds on screen for this category, never overlapping another slice. */
  duration: number;
  occurrences: number;
  topKeys: Array<{ key: string; duration: number; kind: "app" | "domain" }>;
}

const MS_PER_SECOND = 1000;

export interface Categorization {
  slices: CategorySlice[];
  total: number;
  /** Per-category intervals that are guaranteed not to overlap any other category. */
  exclusive: Array<{ id: string; events: TimedEvent[] }>;
}

/**
 * Assigns every active millisecond to exactly one category, walking the rules in
 * priority order and removing already-claimed time. Guarantees that category
 * durations sum to the total active time.
 */
export function categorize(events: TimedEvent[], settings: Settings, from: number, to: number): Categorization {
  const compiled = compileCategories(settings);
  const byCategory = new Map<string, TimedEvent[]>();
  for (const event of events) {
    const id = classify(event, compiled);
    const list = byCategory.get(id);
    if (list) list.push(event);
    else byCategory.set(id, [event]);
  }

  const order = [...compiled.map((c) => c.id), UNCATEGORIZED];
  const labelFor = new Map<string, { zh: string; en: string }>();
  const weightFor = new Map<string, number>();
  const colorFor = new Map<string, number>();
  for (const c of compiled) {
    labelFor.set(c.id, c.label);
    weightFor.set(c.id, c.weight);
    colorFor.set(c.id, c.color);
  }
  labelFor.set(UNCATEGORIZED, { zh: "未分类", en: "Uncategorized" });
  weightFor.set(UNCATEGORIZED, settings.uncategorizedWeight);
  colorFor.set(UNCATEGORIZED, 18);

  const slices: CategorySlice[] = [];
  const exclusive: Categorization["exclusive"] = [];
  let claimed: Interval[] = [];
  let total = 0;

  for (const id of order) {
    const list = byCategory.get(id);
    if (!list || list.length === 0) continue;
    const free = invertIntervals(claimed, from, to);
    const clipped = clipToIntervals(list, free);
    const duration = coverageDuration(clipped);
    if (duration <= 0) continue;
    const grouped = groupBy(clipped, displayKeyOf);
    const durationSeconds = duration / MS_PER_SECOND;
    total += durationSeconds;
    claimed = mergeIntervals([...claimed, ...clipped]);
    exclusive.push({ id, events: clipped });
    slices.push({
      id,
      label: labelFor.get(id) ?? { zh: id, en: id },
      weight: weightFor.get(id) ?? 0,
      color: colorFor.get(id) ?? 18,
      duration: Math.round(durationSeconds),
      occurrences: clipped.length,
      topKeys: grouped.slice(0, 6).map((g) => ({
        key: g.key,
        duration: Math.round(g.duration / MS_PER_SECOND),
        // Same test as displayKeyOf: a key built from a url is a site, otherwise an app.
        kind: typeof g.events[0].data.url === "string" ? "domain" : "app",
      })),
    });
  }

  return {
    slices: slices.sort((a, b) => b.duration - a.duration),
    total,
    exclusive,
  };
}

/** "What was I doing inside this category": the app name, or the site for browser events. */
function displayKeyOf(event: TimedEvent): string | null {
  if (typeof event.data.url === "string") return hostFromUrl(event.data.url);
  if (typeof event.data.app === "string") return event.data.app.replace(/\.exe$/i, "");
  return null;
}

/** Weighted productivity score over the category slices, 0-100. */
export function productivityScore(slices: CategorySlice[], total: number): number {
  if (total <= 0) return 0;
  const weighted = slices.reduce((acc, s) => acc + (s.duration / total) * s.weight, 0);
  return Math.round(weighted * 1000) / 10;
}

export function splitByWeight(slices: CategorySlice[], threshold: number) {
  let productive = 0;
  let leisure = 0;
  for (const s of slices) {
    if (s.weight >= threshold) productive += s.duration;
    else leisure += s.duration;
  }
  return { productive, leisure };
}
