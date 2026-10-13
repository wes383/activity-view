"use client";

import * as React from "react";
import { Search } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { useRange } from "@/components/range-provider";
import { useApi } from "@/lib/hooks";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/display";
import { Segmented } from "@/components/ui/controls";
import { Panel } from "@/components/panels/panel";
import { StatCard, MetricRow } from "@/components/panels/stat-card";
import { BarRank, Heatmap } from "@/components/charts/blocks";
import {
  chartColor,
  cn,
  formatDateTime,
  formatDuration,
  hourLabel,
  prettyAppName,
  truncate,
  WEEKDAYS,
} from "@/lib/utils";
import type { OverviewPayload } from "@/lib/core/analytics";

export default function OverviewPage() {
  const { d, lang } = useLanguage();
  const range = useRange();
  const { data, error, isLoading } = useApi<OverviewPayload>(`/api/overview?${range.query}`);

  const fmt = (seconds: number) => formatDuration(seconds, lang);
  const empty = (data?.totals.range ?? 0) <= 0;
  // Today's own total is the selected range, so the three fixed-period cards carry the
  // information instead; every other range only needs the range card.
  const isToday = range.key === "today";
  const cards = isToday
    ? [
        { label: d.overview.heroToday, value: data?.totals.today ?? 0, accent: chartColor(1) },
        { label: d.overview.heroWeek, value: data?.totals.week ?? 0, accent: chartColor(2) },
        { label: d.overview.heroMonth, value: data?.totals.month ?? 0, accent: chartColor(4) },
      ]
    : [
        {
          label: d.overview.heroRange,
          value: data?.totals.range ?? 0,
          accent: chartColor(10),
          hint: `${d.ui.perDay} ${fmt(data?.totals.averagePerDay ?? 0)} · ${d.ui.activeDays} ${
            data?.totals.activeDays ?? 0
          }`,
        },
      ];

  return (
    <>
      <PageHeader title={d.overview.title} description={d.overview.description} />

      <div className={cn("grid gap-4", isToday ? "sm:grid-cols-2 xl:grid-cols-3" : "grid-cols-1")}>
        {isLoading && !data
          ? cards.map((card) => <Skeleton key={card.label} className="h-[116px] rounded-lg" />)
          : cards.map((card) => (
              <StatCard
                key={card.label}
                label={card.label}
                value={fmt(card.value)}
                hint={"hint" in card ? card.hint : undefined}
                accent={card.accent}
              />
            ))}
      </div>

      <Card className="mt-4">
        <CardContent className="pt-5">
          <MetricRow
            items={[
              { label: d.timeline.switches, value: String(data?.totals.switches ?? 0) },
              { label: d.overview.browsingTime, value: fmt(data?.totals.browsing ?? 0) },
              { label: d.overview.afkTime, value: fmt(data?.totals.afk ?? 0) },
              {
                label: d.overview.busiestHour,
                value: data?.busiestHour != null ? hourLabel(data.busiestHour, lang) : "—",
              },
            ]}
          />
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel
          title={d.overview.apps}
          isLoading={isLoading && !data}
          error={error}
          isEmpty={empty}
          bodyClassName="px-2 py-2"
        >
          <BarRank
            rows={(data?.topApps ?? []).map((item, index) => ({
              key: prettyAppName(item.key),
              duration: item.duration,
              occurrences: item.occurrences,
              color: chartColor(index + 1),
              hint: `${item.key} · ${d.ui.longest} ${fmt(item.longestRun)} · ${d.ui.lastSeen} ${formatDateTime(
                item.lastSeen,
                lang
              )}`,
            }))}
            formatDuration={fmt}
            emptyText={d.ui.noData}
          />
        </Panel>

        <WebPanel fmt={fmt} data={data} isLoading={isLoading && !data} error={error} isEmpty={empty} />
      </div>

      <Card className="mt-4">
        <div className="flex flex-col gap-1.5 p-5">
          <h3 className="font-display text-lg font-semibold leading-tight tracking-tight">{d.overview.heatmap}</h3>
          <p className="text-sm text-foreground-muted">{d.overview.heatmapHint}</p>
        </div>
        <CardContent className="pb-6">
          {isLoading && !data ? (
            <Skeleton className="h-[190px]" />
          ) : (
            <Heatmap
              matrix={data?.heatmap.matrix ?? emptyMatrix()}
              weekdayLabels={WEEKDAYS[lang]}
              hourLabels={Array.from({ length: 24 }, (_, hour) => hourLabel(hour, lang))}
              formatValue={fmt}
              legendLabels={[d.overview.less, d.overview.more]}
            />
          )}
        </CardContent>
      </Card>

      <TitlesPanel data={data} fmt={fmt} isLoading={isLoading && !data} error={error} />
    </>
  );
}

function emptyMatrix(): number[][] {
  return Array.from({ length: 7 }, () => new Array<number>(24).fill(0));
}

function WebPanel({
  data,
  fmt,
  ...state
}: {
  data?: OverviewPayload;
  fmt: (seconds: number) => string;
  isLoading: boolean;
  error?: unknown;
  isEmpty?: boolean;
}) {
  const { d } = useLanguage();
  const [mode, setMode] = React.useState<"domains" | "urls">("domains");
  const rows = (mode === "domains" ? data?.topDomains : data?.topUrls) ?? [];

  return (
    <Panel
      title={mode === "domains" ? d.overview.domains : d.overview.urls}
      isLoading={state.isLoading}
      error={state.error}
      isEmpty={state.isEmpty}
      bodyClassName="px-2 py-2"
      action={
        <Segmented
          ariaLabel="web-ranking"
          value={mode}
          onChange={setMode}
          options={[
            { value: "domains", label: d.overview.domains },
            { value: "urls", label: d.overview.urls },
          ]}
        />
      }
    >
      <BarRank
        rows={rows.map((item, index) => ({
          key: truncate(item.key, 44),
          duration: item.duration,
          occurrences: item.occurrences,
          color: chartColor(index + 6),
        }))}
        formatDuration={fmt}
        emptyText={d.ui.noData}
      />
    </Panel>
  );
}

function TitlesPanel({
  data,
  fmt,
  isLoading,
  error,
}: {
  data?: OverviewPayload;
  fmt: (seconds: number) => string;
  isLoading: boolean;
  error?: unknown;
}) {
  const { d, lang } = useLanguage();
  const [query, setQuery] = React.useState("");
  const all = data?.topTitles ?? [];
  const rows = query.trim()
    ? all.filter((row) => row.key.toLowerCase().includes(query.trim().toLowerCase()))
    : all;

  return (
    <Panel
      className="mt-4"
      title={`${d.overview.titles} · ${all.length}`}
      description={d.overview.topCount.replace("{n}", String(Math.min(60, all.length)))}
      isLoading={isLoading}
      error={error}
      isEmpty={all.length === 0}
      skeletonHeight={300}
      bodyClassName="py-3"
      action={
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-subtle"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={d.ui.search}
            aria-label={d.ui.search}
            className="h-8 w-[190px] rounded-md border border-border bg-surface pl-8 pr-2 text-xs outline-none transition-colors focus:border-border-strong"
          />
        </div>
      }
    >
      {/* pr clears the ~15px scrollbar so the durations are not crowded by it. */}
      <div className="flex max-h-[440px] flex-col overflow-y-auto pr-4">
        {rows.slice(0, 60).map((row, index) => (
          <div key={row.key} className="flex items-start gap-3 border-b border-border py-2.5 last:border-b-0">
            <span className="w-5 shrink-0 pt-0.5 text-right text-[11px] tabular-nums text-foreground-faint">
              {index + 1}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="break-words text-sm text-foreground">{row.key}</span>
              <span className="text-[11px] text-foreground-subtle">
                {row.occurrences} × · {d.ui.longest} {fmt(row.longestRun)} · {d.ui.lastSeen}{" "}
                {formatDateTime(row.lastSeen, lang)}
              </span>
            </span>
            <span className="shrink-0 pt-0.5 text-sm tabular-nums text-foreground-muted">{fmt(row.duration)}</span>
          </div>
        ))}
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-foreground-subtle">{d.ui.noData}</p>
        ) : null}
      </div>
    </Panel>
  );
}
