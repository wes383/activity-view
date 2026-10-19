"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Minus } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { useRange } from "@/components/range-provider";
import { useApi } from "@/lib/hooks";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/display";
import { Segmented } from "@/components/ui/controls";
import { Panel } from "@/components/panels/panel";
import { Donut, StackedBars } from "@/components/charts/blocks";
import { LineChart } from "@/components/charts/line-chart";
import { chartColor, formatDateRange, formatDuration, formatPeriodDetail, formatPeriodLabel, truncate } from "@/lib/utils";
import { AssignPopover } from "@/components/assign-popover";
import type { CategoriesPayload, PeriodEntry } from "@/lib/core/analytics";
import type { CategorySlice } from "@/lib/core/categories";

/** Mirrors `UNCATEGORIZED` in lib/core/categories.ts, which stays server-side. */
const UNCATEGORIZED = "__uncategorized__";
const DAY_MS = 86_400_000;

export default function CategoriesPage() {
  const { d, lang } = useLanguage();
  const range = useRange();
  const { data, error, isLoading, mutate } = useApi<CategoriesPayload>(`/api/categories?${range.query}`);

  const fmt = (seconds: number) => formatDuration(seconds, lang);
  const labelOf = (slice: Pick<CategorySlice, "label">) => slice.label[lang];
  const empty = !data || data.totals.active <= 0;

  const [trendMode, setTrendMode] = React.useState<"daily" | "weekly">("daily");
  const [detailOpen, setDetailOpen] = React.useState(true);
  const [webOpen, setWebOpen] = React.useState(true);
  // Past a month the daily bars collapse into a solid block, so weekly is the only view.
  const dailyAllowed = data ? (data.range.to - data.range.from) / DAY_MS <= 31 : true;
  const activeTrendMode = dailyAllowed ? trendMode : "weekly";
  const trend: PeriodEntry[] = data
    ? activeTrendMode === "daily"
      ? data.daily
      : data.weekly
    : [];
  const order = data?.slices.map((slice) => slice.id) ?? [];
  // A weekly bar covers seven days, so its hover card names the span instead of the Monday.
  const trendDetail = (period: string, index: number) =>
    activeTrendMode === "weekly" && trend[index]
      ? formatDateRange(trend[index].from, trend[index].to, lang)
      : formatPeriodDetail(period, lang);

  return (
    <>
      <PageHeader title={d.categories.title} description={d.categories.description} />

      <div className="grid gap-4 lg:grid-cols-3">
        {isLoading && !data ? (
          Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-[150px] rounded-lg" />)
        ) : (
          <>
            <ScoreCard score={data?.score ?? 0} previous={data?.previousScore ?? null} />
            <SplitCard data={data} fmt={fmt} />
            <Card className="flex flex-col">
              <CardHeader title={d.categories.topItems} description={d.categories.manageRules} />
              <CardContent className="flex flex-wrap gap-2 pb-5">
                {(data?.slices ?? []).slice(0, 6).map((slice) => (
                  <Badge key={slice.id} variant="outline" dot={chartColor(slice.color)}>
                    {truncate(labelOf(slice), 12)} · {Math.round((slice.duration / Math.max(1, data?.totals.active ?? 1)) * 100)}%
                  </Badge>
                ))}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,420px)_1fr]">
        <Panel
          title={d.categories.breakdown}
          isLoading={isLoading && !data}
          error={error}
          isEmpty={empty}
          skeletonHeight={220}
        >
          <Donut
            segments={(data?.slices ?? []).map((slice) => ({
              id: slice.id,
              label: labelOf(slice),
              duration: slice.duration,
              color: chartColor(slice.color),
            }))}
            centerLabel={d.overview.activeTime}
            centerValue={fmt(data?.totals.active ?? 0)}
            formatDuration={fmt}
          />
        </Panel>

        <Panel
          title={d.categories.detail}
          description={d.categories.manageRules}
          isLoading={isLoading && !data}
          error={error}
          isEmpty={empty}
          skeletonHeight={220}
          bodyClassName="p-0"
          action={<CollapseToggle open={detailOpen} onToggle={() => setDetailOpen(!detailOpen)} />}
        >
          <ul>
            {(data?.slices ?? []).map((slice) => (
              <li key={slice.id} className="border-b border-border px-5 py-4 last:border-b-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: chartColor(slice.color) }} />
                  <span className="text-sm font-medium">{labelOf(slice)}</span>
                  <Badge size="xs" variant={slice.weight >= 0.6 ? "success" : slice.weight >= 0.35 ? "warning" : "secondary"}>
                    {d.ui.weight} {slice.weight.toFixed(2)}
                  </Badge>
                  <span className="ml-auto text-sm tabular-nums">{fmt(slice.duration)}</span>
                  <span className="w-12 text-right text-xs tabular-nums text-foreground-subtle">
                    {Math.round((slice.duration / Math.max(1, data?.totals.active ?? 1)) * 100)}%
                  </span>
                </div>
                {detailOpen ? (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 pl-[18px]">
                    {slice.id === UNCATEGORIZED
                      ? slice.topKeys.map((item) => (
                          <AssignPopover key={item.key} item={item} duration={fmt(item.duration)} onAssigned={mutate} />
                        ))
                      : slice.topKeys.map((item) => (
                          <span key={item.key} className="text-xs text-foreground-muted">
                            {truncate(item.key, 30)}
                            <span className="ml-1 tabular-nums text-foreground-subtle">{fmt(item.duration)}</span>
                          </span>
                        ))}
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Card className="mt-4">
        <CardHeader
          title={activeTrendMode === "daily" ? d.categories.dailyTrend : d.categories.weeklyTrend}
          action={
            dailyAllowed ? (
              <Segmented
                ariaLabel="trend-granularity"
                value={activeTrendMode}
                onChange={setTrendMode}
                options={[
                  { value: "daily", label: d.trends.granularityDay },
                  { value: "weekly", label: d.trends.granularityWeek },
                ]}
              />
            ) : undefined
          }
        />
        <CardContent>
          {isLoading && !data ? (
            <Skeleton className="h-[200px]" />
          ) : (
            <StackedBars
              columns={trend.map((period) => ({
                period: period.period,
                total: period.active,
                segments: order
                  .map((id) => {
                    const slice = data?.slices.find((s) => s.id === id);
                    return {
                      id,
                      duration: period.byCategory[id] ?? 0,
                      color: chartColor(slice?.color ?? 18),
                    };
                  })
                  .filter((segment) => segment.duration > 0),
              }))}
              segmentOrder={order}
              formatLabel={(period) => formatPeriodLabel(period, lang)}
              formatDetailLabel={trendDetail}
              formatValue={fmt}
              legend={(data?.slices ?? []).map((slice) => ({
                id: slice.id,
                label: labelOf(slice),
                color: chartColor(slice.color),
              }))}
              emptyText={d.ui.noData}
            />
          )}
        </CardContent>
      </Card>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Card className="flex flex-col">
          <CardHeader title={d.trends.scoreTrend} description={d.categories.scoreHint} />
          <CardContent className="flex-1">
            {isLoading && !data ? (
              <Skeleton className="h-[180px]" />
            ) : (
              <LineChart
                labels={trend.map((period) => period.period)}
                series={[{ key: d.categories.score, color: chartColor(1), values: trend.map((period) => period.score) }]}
                formatValue={(value) => `${Math.round(value)}`}
                formatLabel={(period) => formatPeriodLabel(period, lang)}
                formatDetailLabel={trendDetail}
                emptyText={d.ui.noData}
                showLegend={false}
                height={190}
                fill
              />
            )}
          </CardContent>
        </Card>

        <Panel
          title={d.categories.webBreakdown}
          isLoading={isLoading && !data}
          error={error}
          isEmpty={!data || data.webSlices.length === 0}
          skeletonHeight={180}
          bodyClassName="p-0"
          action={<CollapseToggle open={webOpen} onToggle={() => setWebOpen(!webOpen)} />}
        >
          <ul>
            {(data?.webSlices ?? []).map((slice) => {
              const webTotal = (data?.webSlices ?? []).reduce((acc, s) => acc + s.duration, 0);
              return (
                <li key={slice.id} className="border-b border-border last:border-b-0">
                  <div className="flex items-center gap-3 px-5 py-3">
                    <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: chartColor(slice.color) }} />
                    <span className="text-sm">{labelOf(slice)}</span>
                    <span className="ml-auto text-sm tabular-nums">{fmt(slice.duration)}</span>
                    <span className="w-10 text-right text-xs tabular-nums text-foreground-subtle">
                      {Math.round((slice.duration / Math.max(1, webTotal)) * 100)}%
                    </span>
                  </div>
                  {webOpen && slice.topKeys.length > 0 ? (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 px-5 pb-3">
                      {slice.id === UNCATEGORIZED
                        ? slice.topKeys.map((item) => (
                            <AssignPopover key={item.key} item={item} duration={fmt(item.duration)} onAssigned={mutate} />
                          ))
                        : slice.topKeys.map((item) => (
                            <span key={item.key} className="text-xs text-foreground-muted">
                              {truncate(item.key, 30)}
                              <span className="ml-1 tabular-nums text-foreground-subtle">{fmt(item.duration)}</span>
                            </span>
                          ))}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Panel>
      </div>
    </>
  );
}

/** Toggles the per-category detail rows; the aggregate numbers stay visible. */
function CollapseToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { d } = useLanguage();
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label={open ? d.ui.collapse : d.ui.expand}
      aria-expanded={open}
      onClick={onToggle}
    >
      {open ? (
        <ChevronUp className="h-4 w-4" aria-hidden="true" />
      ) : (
        <ChevronDown className="h-4 w-4" aria-hidden="true" />
      )}
    </Button>
  );
}

function ScoreCard({ score, previous }: { score: number; previous: number | null }) {
  const { d } = useLanguage();
  const delta = previous == null ? null : Math.round((score - previous) * 10) / 10;
  const tone = score >= 66 ? chartColor(2) : score >= 40 ? chartColor(6) : chartColor(13);
  const circumference = 2 * Math.PI * 34;

  return (
    <Card className="flex items-center gap-5 p-5">
      <div className="relative h-[92px] w-[92px] shrink-0">
        <svg width={92} height={92} viewBox="0 0 92 92" role="img" aria-label={d.categories.score}>
          <circle cx={46} cy={46} r={34} fill="none" stroke="var(--hover-strong)" strokeWidth={9} />
          <circle
            cx={46}
            cy={46}
            r={34}
            fill="none"
            stroke={tone}
            strokeWidth={9}
            strokeLinecap="round"
            strokeDasharray={`${(Math.min(100, Math.max(0, score)) / 100) * circumference} ${circumference}`}
            transform="rotate(-90 46 46)"
            className="transition-all duration-200 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-xl font-semibold leading-none tabular-nums">{score.toFixed(0)}</span>
          <span className="text-[10px] text-foreground-subtle">/ 100</span>
        </div>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">{d.categories.score}</span>
        <p className="text-xs text-foreground-muted">{d.categories.scoreHint}</p>
        {delta != null ? (
          <span
            className={
              delta === 0
                ? "inline-flex items-center gap-1 text-xs text-foreground-muted"
                : `inline-flex items-center gap-1 text-xs ${delta > 0 ? "text-green-fg" : "text-red-fg"}`
            }
          >
            {delta > 0 ? <ArrowUp className="h-3 w-3" /> : delta < 0 ? <ArrowDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
            {delta > 0 ? "+" : ""}
            {delta.toFixed(1)} · {d.categories.vsPrevious}
          </span>
        ) : null}
      </div>
    </Card>
  );
}

function SplitCard({ data, fmt }: { data?: CategoriesPayload; fmt: (seconds: number) => string }) {
  const { d } = useLanguage();
  const productive = data?.split.productive ?? 0;
  const leisure = data?.split.leisure ?? 0;
  const total = Math.max(1, productive + leisure);
  const share = Math.round((productive / total) * 100);

  return (
    <Card className="flex flex-col">
      <CardHeader title={d.categories.workVsLeisure} description={`${d.categories.threshold} ${data?.split.threshold ?? 0.5}`} />
      <CardContent className="flex flex-col gap-3">
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-hover-strong">
          <div style={{ width: `${share}%`, background: chartColor(2) }} />
          <div style={{ width: `${100 - share}%`, background: chartColor(3) }} />
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: chartColor(2) }} />
            {d.categories.work}
            <span className="tabular-nums text-foreground-muted">{fmt(productive)}</span>
            <span className="tabular-nums text-foreground-subtle">{share}%</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: chartColor(3) }} />
            {d.categories.leisure}
            <span className="tabular-nums text-foreground-muted">{fmt(leisure)}</span>
            <span className="tabular-nums text-foreground-subtle">{100 - share}%</span>
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
