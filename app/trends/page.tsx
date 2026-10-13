"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Minus, Trophy } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { useRange } from "@/components/range-provider";
import { useApi } from "@/lib/hooks";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/display";
import { Segmented } from "@/components/ui/controls";
import { Panel } from "@/components/panels/panel";
import { StatCard } from "@/components/panels/stat-card";
import { LineChart } from "@/components/charts/line-chart";
import {
  chartColor,
  formatDateRange,
  formatDayLabel,
  formatDuration,
  formatPeriodDetail,
  formatPeriodLabel,
  prettyAppName,
  toDayKey,
} from "@/lib/utils";
import type { PeriodEntry, TrendsPayload } from "@/lib/core/analytics";

export default function TrendsPage() {
  const { d, lang } = useLanguage();
  const range = useRange();
  const [granularity, setGranularity] = React.useState<"day" | "week" | "month">("day");
  const { data, error, isLoading } = useApi<TrendsPayload>(`/api/trends?${range.query}&granularity=${granularity}`);

  const fmt = (seconds: number) => formatDuration(seconds, lang);
  const labelOf = (period: string) => formatPeriodLabel(period, lang);
  const detailOf = (period: string) => formatPeriodDetail(period, lang);
  const periods: PeriodEntry[] = data?.periods ?? [];
  // `current.average` is total ÷ period count, so the label has to track the granularity.
  const averageLabel = granularity === "day" ? d.ui.perDay : granularity === "week" ? d.ui.perWeek : d.ui.perMonth;

  return (
    <>
      <PageHeader
        title={d.trends.title}
        description={d.trends.description}
        actions={
          <Segmented
            ariaLabel="granularity"
            value={granularity}
            onChange={setGranularity}
            options={[
              { value: "day", label: d.trends.granularityDay },
              { value: "week", label: d.trends.granularityWeek },
              { value: "month", label: d.trends.granularityMonth },
            ]}
          />
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isLoading && !data ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[116px] rounded-lg" />)
        ) : (
          <>
            <StatCard
              label={d.trends.currentPeriod}
              value={fmt(data?.current.total ?? 0)}
              hint={`${d.ui.total} · ${data ? d.trends.periods.replace("{n}", String(data.periods.length)) : ""}`}
              accent={chartColor(1)}
            />
            <StatCard
              label={averageLabel}
              value={fmt(data?.current.average ?? 0)}
              hint={d.ui.average}
              accent={chartColor(2)}
            />
            <StatCard
              label={d.categories.score}
              value={(data?.current.score ?? 0).toFixed(1)}
              accent={chartColor(4)}
            />
            <StatCard
              label={d.trends.dataSince}
              value={data?.records.since ? formatDayLabel(data.records.since, lang, "long") : "—"}
              accent={chartColor(16)}
            />
          </>
        )}
      </div>

      <Card className="mt-4">
        <CardHeader title={d.trends.activeTrend} description={d.trends.periods.replace("{n}", String(periods.length))} />
        <CardContent>
          {isLoading && !data ? (
            <Skeleton className="h-[220px]" />
          ) : (
            <LineChart
              labels={periods.map((period) => period.period)}
              series={[{ key: d.overview.activeTime, color: chartColor(1), values: periods.map((period) => period.active) }]}
              formatValue={(value) => (value >= 3600 ? `${Math.round(value / 3600)}h` : `${Math.round(value / 60)}m`)}
              formatLabel={labelOf}
              formatDetailLabel={detailOf}
              emptyText={d.trends.noTrend}
              showLegend={false}
              height={230}
            />
          )}
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel
          title={d.trends.previous}
          isLoading={isLoading && !data}
          error={error}
          skeletonHeight={140}
        >
          <ComparisonRow block={data?.comparison.find((c) => c.key === "previous")} fmt={fmt} scoreLabel={d.categories.score} />
        </Panel>

        <Panel
          title={d.trends.lastYear}
          isLoading={isLoading && !data}
          error={error}
          isEmpty={data ? data.comparison.find((c) => c.key === "lastYear")?.total === 0 && (data.comparison.find((c) => c.key === "lastYear")?.score ?? 0) === 0 : false}
          emptyTitle={d.trends.notEnough}
          skeletonHeight={140}
        >
          <ComparisonRow block={data?.comparison.find((c) => c.key === "lastYear")} fmt={fmt} scoreLabel={d.categories.score} />
        </Panel>
      </div>

      <Card className="mt-4">
        <CardHeader title={d.trends.scoreTrend} />
        <CardContent>
          {isLoading && !data ? (
            <Skeleton className="h-[200px]" />
          ) : (
            <LineChart
              labels={periods.map((period) => period.period)}
              series={[{ key: d.categories.score, color: chartColor(4), values: periods.map((period) => period.score) }]}
              formatValue={(value) => `${Math.round(value)}`}
              formatLabel={labelOf}
              formatDetailLabel={detailOf}
              emptyText={d.trends.noTrend}
              showLegend={false}
              height={210}
            />
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader
          title={d.trends.records}
          action={<Trophy className="h-4 w-4 text-foreground-subtle" aria-hidden="true" />}
        />
        <CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(
            [
              { label: d.trends.mostActive, entry: data?.records.mostActive, kind: "time" },
              { label: d.trends.leastActive, entry: data?.records.leastActive, kind: "time" },
              { label: d.trends.bestScore, entry: data?.records.bestScore, kind: "score" },
              { label: d.trends.worstScore, entry: data?.records.worstScore, kind: "score" },
            ] as const
          ).map((record) => (
            <div key={record.label} className="rounded-md border border-border p-3">
              <p className="text-[11px] uppercase tracking-wide text-foreground-subtle">{record.label}</p>
              {record.entry ? (
                <>
                  <p className="mt-1 text-sm font-medium">{labelOf(record.entry.period)}</p>
                  <p className="text-xs tabular-nums text-foreground-muted">
                    {record.kind === "time" ? fmt(record.entry.active) : `${record.entry.score.toFixed(1)} · ${fmt(record.entry.active)}`}
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-foreground-subtle">—</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>

      <Panel
        className="mt-4"
        title={d.trends.appTrends}
        isLoading={isLoading && !data}
        error={error}
        isEmpty={!data || data.appTrends.length === 0}
        skeletonHeight={210}
      >
        <LineChart
          labels={periods.map((period) => period.period)}
          series={(data?.appTrends ?? []).map((trend, index) => ({
            key: prettyAppName(trend.key),
            color: chartColor(index + 1),
            values: trend.series,
          }))}
          formatValue={(value) => (value >= 3600 ? `${Math.round(value / 3600)}h` : `${Math.round(value / 60)}m`)}
          formatLabel={labelOf}
          formatDetailLabel={detailOf}
          emptyText={d.trends.noTrend}
          area={false}
          height={210}
        />
      </Panel>
    </>
  );
}

function ComparisonRow({
  block,
  fmt,
  scoreLabel,
}: {
  block?: TrendsPayload["comparison"][number];
  fmt: (seconds: number) => string;
  scoreLabel: string;
}) {
  const { d, lang } = useLanguage();
  if (!block) return <p className="text-sm text-foreground-subtle">{d.trends.notEnough}</p>;
  const delta = block.deltaPct;
  const lastDay = Math.max(block.from, block.to - 1);
  const periodLabel = toDayKey(new Date(block.from)) === toDayKey(new Date(lastDay))
    ? formatDayLabel(block.from, lang, "medium")
    : formatDateRange(block.from, block.to, lang);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end justify-between gap-4">
        <div className="flex flex-col">
          <span className="text-xs text-foreground-subtle">{d.trends.comparisonTotal}</span>
          <span className="font-display text-2xl font-semibold tabular-nums leading-tight">{fmt(block.total)}</span>
          <span className="text-[11px] text-foreground-muted">{periodLabel}</span>
        </div>
        {delta != null ? (
          <span
            className={
              delta === 0
                ? "inline-flex items-center gap-1 text-sm text-foreground-muted"
                : `inline-flex items-center gap-1 text-sm ${delta > 0 ? "text-green-fg" : "text-red-fg"}`
            }
          >
            {delta > 0 ? (
              <ArrowUp className="h-4 w-4" aria-hidden="true" />
            ) : delta < 0 ? (
              <ArrowDown className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Minus className="h-4 w-4" aria-hidden="true" />
            )}
            {delta > 0 ? "+" : ""}
            {delta.toFixed(1)}%
          </span>
        ) : null}
      </div>
      <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
        <span className="text-foreground-muted">{scoreLabel}</span>
        <span className="tabular-nums">{block.score != null ? block.score.toFixed(1) : "—"}</span>
      </div>
    </div>
  );
}
