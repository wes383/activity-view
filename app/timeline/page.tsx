"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Coffee, Sun, Zap } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { useApi, useMounted, useNow } from "@/lib/hooks";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/display";
import { Panel } from "@/components/panels/panel";
import { StatCard } from "@/components/panels/stat-card";
import { BarRank, StackedBars, TimelineStrip, type StripView } from "@/components/charts/blocks";
import { Select } from "@/components/ui/select";
import { Hint } from "@/components/ui/tooltip";
import {
  addDaysKey,
  chartColor,
  cn,
  formatClock,
  formatDayLabel,
  formatDuration,
  hourLabel,
  formatSpan,
  parseDayKey,
  prettyAppName,
  truncate,
} from "@/lib/utils";
import type { TimelinePayload } from "@/lib/core/analytics";
import type { Settings } from "@/lib/core/settings";

/** Choices for the strip filter, in seconds. */
const MIN_SECONDS = [0, 5, 15, 30, 60, 300, 600, 1800, 3600];

export default function TimelinePage() {
  const { d, lang } = useLanguage();
  /** Empty means "today"; the API resolves and echoes it back in `data.day`. */
  const [requestedDay, setRequestedDay] = React.useState("");
  const { data, error, isLoading } = useApi<TimelinePayload>(
    `/api/timeline${requestedDay ? `?date=${requestedDay}` : ""}`
  );
  const meta = useCategoryMeta();
  const now = useNow(60_000);

  const day = requestedDay || data?.day || "";
  const fmt = (seconds: number) => formatDuration(seconds, lang);
  const colorOf = (id: string) => chartColor(meta.get(id)?.color ?? 18);
  const labelOf = (id: string) => {
    const entry = meta.get(id);
    return entry ? entry.label[lang] : id;
  };

  const shift = (delta: number) => setRequestedDay(addDaysKey(day, delta));

  // One duration filter drives all three strips below, so short blips can be dropped
  // from the whole day view at once.
  const [minSec, setMinSec] = React.useState("0");
  const minDuration = Number(minSec);
  const keep = (item: { duration: number }) => item.duration >= minDuration;
  const visibleSegments = (data?.segments ?? []).filter(keep);
  const visibleWeb = (data?.webEvents ?? []).filter(keep);
  const visibleAfk = (data?.afkStates ?? []).filter(keep);
  const stripFrom = data?.from ?? Date.parse(`${day}T00:00:00`);
  const stripTo = data?.to ?? Date.parse(`${day}T23:59:59`);
  const webTotal = visibleWeb.reduce((acc, item) => acc + item.duration, 0);
  const peak = peakSwitches(data);
  /** Hour marks stay compact; finer zoom levels need the minutes too. */
  const formatTick = (date: Date) =>
    date.getMinutes() === 0 ? hourLabel(date.getHours(), lang) : formatClock(date.getTime(), lang);

  // Zoom and pan are shared by the three strips, and keyed per day so switching days
  // can never leave a window from another date behind.
  const [views, setViews] = React.useState<Record<string, StripView | null>>({});
  const view = views[day] ?? null;
  const setView = (next: StripView | null) => setViews((prev) => ({ ...prev, [day]: next }));

  // The shell's fixed toolbar row owns the leading slot; it only exists after hydration.
  const toolbar = useMounted() ? document.getElementById("toolbar-lead") : null;

  return (
    <>
      {toolbar
        ? createPortal(
            <div className="flex items-center gap-1.5">
              <Button size="icon" variant="outline" aria-label={d.timeline.prevDay} onClick={() => shift(-1)}>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </Button>
              <input
                type="date"
                aria-label={d.timeline.date}
                value={day}
                onChange={(event) => setRequestedDay(event.target.value)}
                className="h-10 cursor-pointer rounded-lg border border-border bg-surface px-3 text-sm text-foreground transition-colors duration-150 focus:border-border-strong focus:outline-none"
              />
              <Button size="icon" variant="outline" aria-label={d.timeline.nextDay} onClick={() => shift(1)}>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRequestedDay("")}>
                {d.timeline.backToToday}
              </Button>
            </div>,
            toolbar
          )
        : null}

      <PageHeader title={d.timeline.title} description={d.timeline.description} />

      {day && now != null && parseDayKey(day).getTime() > now ? (
        <p className="mb-4 text-sm text-orange-fg">{d.timeline.futureDay}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading && !data ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[116px] rounded-lg" />)
        ) : (
          <>
            <StatCard
              label={d.overview.activeTime}
              value={fmt(data?.totals.active ?? 0)}
              hint={`${d.timeline.eventCount} ${data?.totals.events ?? 0}`}
              accent={chartColor(1)}
            />
            <StatCard
              label={d.timeline.firstActivity}
              value={formatClock(data?.totals.first ?? null, lang)}
              hint={`${d.timeline.lastActivity} ${formatClock(data?.totals.last ?? null, lang)}`}
              accent={chartColor(2)}
            />
            <StatCard
              label={d.timeline.switches}
              value={String(data?.switches.total ?? 0)}
              hint={
                data && data.switches.total > 0
                  ? d.timeline.switchRate.replace("{n}", String(data.switches.averageInterval))
                  : undefined
              }
              accent={chartColor(4)}
            />
            <StatCard
              label={d.timeline.breakTotal}
              value={fmt(data?.breakSummary.total ?? 0)}
              hint={d.timeline.breakCount.replace("{n}", String(data?.breakSummary.count ?? 0))}
              accent={chartColor(7)}
            />
          </>
        )}
      </div>

      <Card className="mt-4">
        <CardHeader
          title={d.timeline.stream}
          description={day ? `${formatDayLabel(day, lang, "long")} · ${fmt(data?.totals.span ?? 0)} ${d.timeline.span.toLowerCase()}` : undefined}
          action={
            <div className="flex items-center gap-2">
              {view ? (
                <Button size="xs" variant="ghost" onClick={() => setView(null)}>
                  {d.timeline.resetZoom}
                </Button>
              ) : null}
              <Select
                className="w-[140px]"
                ariaLabel={d.timeline.minDuration}
                value={minSec}
                onChange={setMinSec}
                options={MIN_SECONDS.map((seconds) => ({
                  value: String(seconds),
                  label: seconds === 0 ? d.ui.all : `≥ ${fmt(seconds)}`,
                }))}
              />
            </div>
          }
        />
        <CardContent className="flex flex-col gap-7">
          {isLoading && !data ? (
            <Skeleton className="h-[230px]" />
          ) : (
            <>
              <TimelineRow
                label={d.timeline.rowApps}
                meta={
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {(data ? groupByCategory(visibleSegments) : []).map(([id, count]) => (
                      <span key={id} className="inline-flex items-center gap-1.5 text-[11px] text-foreground-muted">
                        <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: colorOf(id) }} />
                        {labelOf(id)}
                        <span className="tabular-nums text-foreground-subtle">{count}</span>
                      </span>
                    ))}
                  </div>
                }
              >
                {visibleSegments.length > 0 ? (
                  <TimelineStrip
                    from={stripFrom}
                    to={stripTo}
                    view={view}
                    onViewChange={setView}
                    segments={visibleSegments}
                    colorOf={colorOf}
                    formatTick={formatTick}
                    formatTooltip={(segment) =>
                      `${formatSpan(segment.start, segment.end, lang)}\n${
                        segment.app ? prettyAppName(segment.app) : ""
                      }${segment.title ? `\n${truncate(segment.title, 70)}` : ""}`
                    }
                  />
                ) : (
                  <EmptyRow text={d.ui.noData} />
                )}
              </TimelineRow>

              <TimelineRow
                label={d.timeline.rowWeb}
                meta={
                  <span className="text-[11px] tabular-nums text-foreground-subtle">
                    {visibleWeb.length} · {fmt(webTotal)}
                  </span>
                }
              >
                {visibleWeb.length > 0 ? (
                  <TimelineStrip
                    from={stripFrom}
                    to={stripTo}
                    view={view}
                    onViewChange={setView}
                    height={36}
                    segments={visibleWeb.map((item) => ({
                      start: item.start,
                      end: item.end,
                      categoryId: "web",
                      title: item.title ?? item.url ?? "",
                      app: item.host ?? item.url,
                      duration: item.duration,
                    }))}
                    colorOf={() => chartColor(6)}
                    formatTick={formatTick}
                    formatTooltip={(segment) =>
                      `${formatSpan(segment.start, segment.end, lang)}\n${segment.app ?? ""}${
                        segment.title ? `\n${truncate(segment.title, 70)}` : ""
                      }`
                    }
                  />
                ) : (
                  <EmptyRow text={d.ui.noData} />
                )}
              </TimelineRow>

              <TimelineRow
                label={d.timeline.rowAfk}
                meta={
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {[
                      { id: "present", label: d.timeline.present, color: chartColor(2) },
                      { id: "afk", label: d.timeline.away, color: chartColor(9) },
                    ].map((item) => (
                      <span key={item.id} className="inline-flex items-center gap-1.5 text-[11px] text-foreground-muted">
                        <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: item.color }} />
                        {item.label}
                      </span>
                    ))}
                  </div>
                }
              >
                {visibleAfk.length > 0 ? (
                  <TimelineStrip
                    from={stripFrom}
                    to={stripTo}
                    view={view}
                    onViewChange={setView}
                    height={36}
                    segments={visibleAfk.map((item) => ({
                      start: item.start,
                      end: item.end,
                      categoryId: item.afk ? "afk" : "present",
                      title: item.afk ? d.timeline.away : d.timeline.present,
                      app: null,
                      duration: item.duration,
                    }))}
                    colorOf={(id) => (id === "afk" ? chartColor(9) : chartColor(2))}
                    formatTick={formatTick}
                    formatTooltip={(segment) =>
                      `${formatSpan(segment.start, segment.end, lang)}\n${segment.title} · ${fmt(segment.duration)}`
                    }
                  />
                ) : (
                  <EmptyRow text={d.ui.noData} />
                )}
              </TimelineRow>
            </>
          )}
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel
          title={d.timeline.sessions}
          description={
            data
              ? d.timeline.sessionsHint
                  .replace("{n}", fmt(data.thresholds.sessionMinSec))
                  .replace("{m}", fmt(data.thresholds.breakThresholdSec))
              : undefined
          }
          isLoading={isLoading && !data}
          error={error}
          isEmpty={!data || data.sessions.length === 0}
          emptyTitle={d.timeline.noSessions}
          skeletonHeight={220}
          bodyClassName="p-0"
        >
          <ul>
            {(data?.sessions ?? []).map((session) => (
              <li key={session.start} className="border-b border-border px-5 py-3 last:border-b-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium tabular-nums">
                    {formatClock(session.start, lang)} → {formatClock(session.end, lang)}
                  </span>
                  <Badge size="xs" variant="secondary">
                    {prettyAppName(session.focusApp)}
                  </Badge>
                  <span className="ml-auto text-sm tabular-nums">{fmt(session.duration)}</span>
                </div>
                <div className="mt-2 flex h-1.5 w-full overflow-hidden rounded-full">
                  {session.categories.map((category) => (
                    <Hint key={category.id} side="top" label={`${labelOf(category.id)} · ${fmt(category.duration)}`}>
                      <div
                        style={{
                          width: `${(category.duration / Math.max(1, session.duration)) * 100}%`,
                          background: colorOf(category.id),
                        }}
                      />
                    </Hint>
                  ))}
                </div>
                <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-foreground-subtle">
                  <span>
                    {d.timeline.switches}: <span className="tabular-nums text-foreground-muted">{session.switches}</span>
                  </span>
                  <span>
                    {d.timeline.focusShare}: <span className="tabular-nums text-foreground-muted">{session.focusShare}%</span>
                  </span>
                  {session.categories.slice(0, 3).map((category) => (
                    <span key={category.id} className="inline-flex items-center gap-1">
                      <span className="h-2 w-2 rounded-full" style={{ background: colorOf(category.id) }} />
                      {labelOf(category.id)}
                    </span>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </Panel>

        <div className="flex flex-col gap-4">
          <Panel
            title={d.timeline.switches}
            isLoading={isLoading && !data}
            error={error}
            isEmpty={!data || data.switches.total === 0}
            skeletonHeight={120}
          >
            <div className="flex flex-col gap-4">
              <div className="flex h-[86px] items-end gap-[3px]">
                {(data?.switches.perHour ?? []).map((count, hour) => {
                  const max = Math.max(1, ...(data?.switches.perHour ?? [1]));
                  return (
                    <Hint key={hour} side="top" label={`${hourLabel(hour, lang)} · ${count}`}>
                      <div
                        className="flex-1 rounded-[2px] bg-hover-strong transition-colors hover:bg-accent"
                        style={{
                          height: `${Math.max(2, (count / max) * 100)}%`,
                          background: count > 0 ? chartColor(4) : undefined,
                        }}
                      />
                    </Hint>
                  );
                })}
              </div>
              <ul className="flex flex-col gap-1.5">
                {(data?.switches.topPairs ?? []).map((pair) => (
                  <li key={`${pair.from}-${pair.to}`} className="flex items-center gap-2 text-sm">
                    <span className="truncate text-foreground-muted">{prettyAppName(pair.from)}</span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-foreground-faint" aria-hidden="true" />
                    <span className="truncate text-foreground">{prettyAppName(pair.to)}</span>
                    <span className="ml-auto tabular-nums text-xs text-foreground-subtle">×{pair.count}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Panel>

          <Panel
            title={d.timeline.longestRuns}
            isLoading={isLoading && !data}
            error={error}
            isEmpty={!data || data.longestRuns.length === 0}
            skeletonHeight={160}
            bodyClassName="px-2 py-2"
          >
            <BarRank
              rows={(data?.longestRuns ?? []).map((run, index) => ({
                key: prettyAppName(run.app),
                duration: run.duration,
                sub: `${formatClock(run.start, lang)} → ${formatClock(run.end, lang)}`,
                color: chartColor(index + 2),
              }))}
              formatDuration={fmt}
              emptyText={d.ui.noData}
            />
          </Panel>
        </div>
      </div>

      <Card className="mt-4">
        <CardHeader
          title={d.timeline.breaks}
          action={
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">
                <Coffee className="h-3 w-3" aria-hidden="true" />
                {d.timeline.breakAverage} {fmt(data?.breakSummary.average ?? 0)}
              </Badge>
              <Badge variant="outline">
                <Sun className="h-3 w-3" aria-hidden="true" />
                {d.timeline.breakLongest} {fmt(data?.breakSummary.longest ?? 0)}
              </Badge>
              {peak ? (
                <Badge variant="outline">
                  <Zap className="h-3 w-3" aria-hidden="true" />
                  {d.timeline.peakHour
                    .replace("{hour}", hourLabel(peak.hour, lang))
                    .replace("{n}", String(peak.count))}
                </Badge>
              ) : null}
            </div>
          }
        />
        <CardContent>
          {isLoading && !data ? (
            <Skeleton className="h-[120px]" />
          ) : (data?.breaks ?? []).length === 0 ? (
            <p className="text-sm text-foreground-subtle">{d.ui.noData}</p>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {(data?.breaks ?? []).map((brk) => (
                <Hint
                  key={brk.start}
                  side="top"
                  label={`${formatClock(brk.start, lang)} → ${formatClock(brk.end, lang)}`}
                >
                  <li
                    className={cn(
                      "flex flex-col gap-0.5 rounded-md border px-3 py-2",
                      brk.kind === "long"
                        ? "border-orange-border bg-orange-soft"
                        : brk.kind === "short"
                          ? "border-blue-border bg-blue-soft"
                          : "border-border bg-surface"
                    )}
                  >
                    <span className="text-sm font-medium tabular-nums">{fmt(brk.duration)}</span>
                    <span className="text-[11px] text-foreground-muted">
                      {d.timeline[brk.kind]} · {formatClock(brk.start, lang)}
                    </span>
                  </li>
                </Hint>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader title={d.overview.hourly} description={d.overview.heatmapHint} />
        <CardContent>
          {isLoading && !data ? (
            <Skeleton className="h-[200px]" />
          ) : (
            /* Single series: the segment id is what the hover row prints, so no legend. */
            <StackedBars
              columns={(data?.hourly ?? []).map((value, hour) => ({
                period: String(hour),
                total: value,
                segments: [{ id: d.overview.activeTime, duration: value, color: chartColor(1) }],
              }))}
              segmentOrder={[d.overview.activeTime]}
              formatLabel={(period) => hourLabel(Number(period), lang)}
              formatValue={fmt}
              legend={[]}
              emptyText={d.ui.noData}
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}

/** One labelled strip; the card's duration filter applies to all of them. */
function TimelineRow({ label, meta, children }: { label: string; meta?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <h4 className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">{label}</h4>
        {meta ? <div className="ml-auto flex min-w-0 items-end justify-end">{meta}</div> : null}
      </div>
      {children}
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return <p className="text-sm text-foreground-subtle">{text}</p>;
}

function peakSwitches(data?: TimelinePayload): { hour: number; count: number } | null {
  let hour = -1;
  let count = 0;
  (data?.switches.perHour ?? []).forEach((value, index) => {
    if (value > count) {
      count = value;
      hour = index;
    }
  });
  return hour < 0 ? null : { hour, count };
}

function groupByCategory(segments: Array<{ categoryId: string }>): Array<[string, number]> {
  const counts = new Map<string, number>();
  for (const segment of segments) counts.set(segment.categoryId, (counts.get(segment.categoryId) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

/** Colors and labels come from the category definitions, which are stable
 *  across days — unlike a per-range aggregation. */
function useCategoryMeta(): Map<string, { label: { zh: string; en: string }; color: number }> {
  const { data } = useApi<{ settings: Settings }>("/api/settings");
  return React.useMemo(() => {
    const map = new Map<string, { label: { zh: string; en: string }; color: number }>();
    for (const category of data?.settings.categories ?? []) {
      map.set(category.id, { label: category.label, color: category.color });
    }
    map.set("__uncategorized__", { label: { zh: "未分类", en: "Uncategorized" }, color: 18 });
    return map;
  }, [data]);
}
