"use client";

import * as React from "react";
import { cn, isAxisTick } from "@/lib/utils";
import { Hint, Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

const HOUR_MS = 60 * 60 * 1000;

/* ── Horizontal ranking bars ─────────────────────────────────────────── */

export interface RankRow {
  key: string;
  duration: number;
  occurrences?: number;
  longestRun?: number;
  hint?: string;
  sub?: string;
  color?: string;
}

export function BarRank({
  rows,
  formatDuration,
  emptyText,
  max: providedMax,
  onSelect,
  activeKey,
}: {
  rows: RankRow[];
  formatDuration: (seconds: number) => string;
  emptyText: string;
  max?: number;
  onSelect?: (key: string) => void;
  activeKey?: string | null;
}) {
  if (rows.length === 0) {
    return <p className="px-5 pb-5 text-sm text-foreground-subtle">{emptyText}</p>;
  }
  const max = providedMax ?? rows[0].duration ?? 1;
  return (
    <ul className="flex flex-col">
      {rows.map((row, index) => {
        const width = max > 0 ? Math.max(1.5, (row.duration / max) * 100) : 0;
        const body = (
          <>
            <span className="w-5 shrink-0 text-right text-xs tabular-nums text-foreground-faint">{index + 1}</span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="flex items-baseline gap-2">
                <span className="truncate text-sm font-medium text-foreground">{row.key}</span>
                {row.sub ? <span className="shrink-0 text-xs text-foreground-subtle">{row.sub}</span> : null}
              </span>
              <span className="block h-1.5 w-full overflow-hidden rounded-full bg-hover">
                <span
                  className="block h-full rounded-full transition-all duration-200 ease-out"
                  style={{ width: `${width}%`, background: row.color ?? "var(--accent)" }}
                />
              </span>
            </span>
            <span className="shrink-0 text-right">
              <span className="block text-sm tabular-nums text-foreground">{formatDuration(row.duration)}</span>
              {row.occurrences !== undefined ? (
                <span className="block text-[11px] tabular-nums text-foreground-faint">×{row.occurrences}</span>
              ) : null}
            </span>
          </>
        );
        const rowClass = cn(
          "group flex w-full items-center gap-3 rounded-md px-1 py-1.5 text-left transition-colors",
          onSelect && "cursor-pointer hover:bg-hover",
          activeKey === row.key && "bg-hover"
        );
        const rowElement = onSelect ? (
          <button type="button" onClick={() => onSelect(row.key)} aria-pressed={activeKey === row.key} className={rowClass}>
            {body}
          </button>
        ) : (
          <div className={rowClass}>{body}</div>
        );

        return (
          <li key={row.key} className="px-5 first:pt-1 last:pb-1">
            {row.hint ? <Hint label={row.hint}>{rowElement}</Hint> : rowElement}
          </li>
        );
      })}
    </ul>
  );
}

/* ── Weekday × hour heatmap ──────────────────────────────────────────── */

const HEAT_STEPS = ["var(--heat-0)", "var(--heat-1)", "var(--heat-2)", "var(--heat-3)", "var(--heat-4)", "var(--heat-5)"];

function heatColor(value: number, max: number): string {
  if (value <= 0 || max <= 0) return HEAT_STEPS[0];
  const ratio = value / max;
  const index = Math.min(HEAT_STEPS.length - 1, Math.ceil(ratio * (HEAT_STEPS.length - 1)) || 1);
  return HEAT_STEPS[index];
}

export function Heatmap({
  matrix,
  weekdayLabels,
  hourLabels,
  formatValue,
  legendLabels,
}: {
  matrix: number[][];
  weekdayLabels: string[];
  hourLabels: string[];
  formatValue: (seconds: number) => string;
  legendLabels: string[];
}) {
  const max = Math.max(1, ...matrix.flat());
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[560px] grid-cols-[auto_repeat(24,minmax(0,1fr))] gap-[3px]">
          <span />
          {hourLabels.map((label, index) => (
            <span key={index} className="text-center text-[10px] tabular-nums text-foreground-faint">
              {index % 3 === 0 ? label : ""}
            </span>
          ))}
          {matrix.map((row, dayIndex) => (
            <React.Fragment key={dayIndex}>
              <span className="pr-2 text-right text-[11px] leading-none text-foreground-subtle self-center">
                {weekdayLabels[dayIndex]}
              </span>
              {row.map((value, hour) => (
                <Hint
                  key={hour}
                  side="top"
                  label={`${weekdayLabels[dayIndex]} ${hourLabels[hour]} · ${formatValue(value)}`}
                >
                  <div
                    className="h-5 rounded-[3px] transition-transform duration-150 hover:scale-[1.18] hover:ring-1 hover:ring-border-strong"
                    style={{ background: heatColor(value, max) }}
                  />
                </Hint>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 text-[11px] text-foreground-subtle">
        <span>{legendLabels[0]}</span>
        {HEAT_STEPS.map((step) => (
          <span key={step} className="h-3.5 w-6 rounded-[3px]" style={{ background: step }} />
        ))}
        <span>{legendLabels[1]}</span>
      </div>
    </div>
  );
}

/* ── Stacked columns (one per period) ────────────────────────────────── */

export interface StackSegment {
  id: string;
  duration: number;
  color: string;
}

export function StackedBars({
  columns,
  segmentOrder,
  height = 180,
  formatLabel,
  formatDetailLabel,
  formatValue,
  legend,
  emptyText,
}: {
  columns: Array<{ period: string; total: number; segments: StackSegment[] }>;
  segmentOrder: string[];
  height?: number;
  formatLabel: (period: string, index: number) => string;
  /** Hover card text; axes stay terse, so this may carry extra detail like the year. */
  formatDetailLabel?: (period: string, index: number) => string;
  formatValue: (seconds: number) => string;
  legend: Array<{ id: string; label: string; color: string }>;
  emptyText: string;
}) {
  const max = Math.max(1, ...columns.map((c) => c.total));
  const stride = Math.max(1, Math.ceil(columns.length / 12));
  const labelled = columns
    .map((column, index) => ({ column, index }))
    .filter(({ index }) => isAxisTick(index, columns.length, stride));
  const hasData = columns.some((c) => c.total > 0);

  if (!hasData) return <p className="px-5 pb-5 text-sm text-foreground-subtle">{emptyText}</p>;

  const labelById = new Map(legend.map((item) => [item.id, item.label]));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-end gap-[3px]" style={{ height }}>
        {columns.map((column, index) => {
          const order = new Map(segmentOrder.map((id, orderIndex) => [id, orderIndex]));
          const sorted = [...column.segments].sort(
            (a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99)
          );
          const details = sorted.filter((segment) => segment.duration > 0);
          return (
            <HoverCard key={column.period}>
              {/* Anchoring on the whole column keeps the card above the chart; a tall bar
                  leaves no room overhead and makes Radix flip it onto the bars. */}
              <HoverCardTrigger asChild>
                <div className="relative flex h-full flex-1 flex-col justify-end">
                  <div
                    className="flex w-full flex-col-reverse overflow-hidden rounded-[3px]"
                    style={{ height: `${(column.total / max) * 100}%` }}
                  >
                    {sorted.map((segment) => (
                      <div
                        key={segment.id}
                        style={{
                          height: `${(segment.duration / Math.max(1, column.total)) * 100}%`,
                          background: segment.color,
                        }}
                        className="w-full"
                      />
                    ))}
                  </div>
                </div>
              </HoverCardTrigger>
              <HoverCardContent side="top" align="center" collisionPadding={12} className="w-56 p-3">
                <div className="flex flex-col gap-2">
                  <div className="text-xs font-medium text-foreground">
                    {(formatDetailLabel ?? formatLabel)(column.period, index)} · {formatValue(column.total)}
                  </div>
                  <div className="flex flex-col gap-1">
                    {details.map((segment) => (
                      <div key={segment.id} className="flex items-center gap-2 text-xs">
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                          style={{ background: segment.color }}
                        />
                        <span className="truncate text-foreground-muted">
                          {labelById.get(segment.id) ?? segment.id}
                        </span>
                        <span className="ml-auto shrink-0 font-medium tabular-nums text-foreground">
                          {formatValue(segment.duration)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          );
        })}
      </div>
      <div className="flex justify-between text-[11px] tabular-nums text-foreground-faint">
        {labelled.map(({ column, index }) => (
          <span key={column.period}>{formatLabel(column.period, index)}</span>
        ))}
      </div>
      {legend.length > 0 ? (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {legend.map((item) => (
            <span key={item.id} className="inline-flex items-center gap-1.5 text-xs text-foreground-muted">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: item.color }} />
              {item.label}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ── Donut ───────────────────────────────────────────────────────────── */

export function Donut({
  segments,
  centerLabel,
  centerValue,
  formatDuration,
  size = 200,
}: {
  segments: Array<{ id: string; label: string; duration: number; color: string }>;
  centerLabel: string;
  centerValue: string;
  formatDuration: (seconds: number) => string;
  size?: number;
}) {
  const [hovered, setHovered] = React.useState<string | null>(null);
  const total = segments.reduce((acc, s) => acc + s.duration, 0);
  const stroke = 18;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  // A CJK duration is a full em per glyph, so "1000 小时 30 分" can outgrow the hole it
  // sits in while the latin form never does; scale the size down instead of clipping.
  const valueSize = Math.max(16, Math.min(24, (radius * 2 - 12) / textUnits(centerValue)));
  let offset = 0;
  const arcs = segments.map((segment) => {
    const share = segment.duration / total;
    const arc = { ...segment, share, dash: share * circumference, offset };
    offset += arc.dash;
    return arc;
  });
  const active = hovered ? arcs.find((arc) => arc.id === hovered) : undefined;

  return (
    <div className="flex flex-wrap items-center gap-6">
      {/* One tooltip for the whole ring: a trigger per arc keeps the previous label on
          screen while the pointer slides from one stroke to the next. */}
      <Tooltip open={active !== undefined}>
        <TooltipTrigger asChild>
          <div className="relative shrink-0" style={{ width: size, height: size }}>
            {/* overflow-visible keeps a hovered, thickened arc from being cut off by the svg box. */}
            <svg width={size} height={size} className="overflow-visible" role="img" aria-label={centerLabel}>
              <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--hover)" strokeWidth={stroke} />
                {total > 0 &&
                  arcs.map((arc) => (
                    <circle
                      key={arc.id}
                      cx={size / 2}
                      cy={size / 2}
                      r={radius}
                      fill="none"
                      stroke={arc.color}
                      strokeWidth={hovered === arc.id ? stroke + 4 : stroke}
                      strokeOpacity={hovered && hovered !== arc.id ? 0.4 : 1}
                      strokeDasharray={`${arc.dash} ${circumference - arc.dash}`}
                      strokeDashoffset={-arc.offset}
                      className="transition-all duration-200 ease-out"
                      onMouseEnter={() => setHovered(arc.id)}
                      onMouseLeave={() => setHovered((current) => (current === arc.id ? null : current))}
                    />
                  ))}
              </g>
            </svg>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display font-semibold tabular-nums leading-none" style={{ fontSize: valueSize }}>
                {centerValue}
              </span>
              <span className="mt-1 text-xs text-foreground-muted">{centerLabel}</span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top">
          {active ? (
            <span className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: active.color }} />
              <span className="truncate">{active.label}</span>
              <span className="shrink-0 tabular-nums text-foreground-muted">
                {formatDuration(active.duration)} · {(active.share * 100).toFixed(1)}%
              </span>
            </span>
          ) : null}
        </TooltipContent>
      </Tooltip>
      <ul className="flex min-w-[180px] flex-1 flex-col gap-1.5">
        {segments.map((segment) => (
          <li key={segment.id} className="flex items-center gap-2 text-sm">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: segment.color }} />
            <span className="truncate text-foreground-muted">{segment.label}</span>
            <span className="ml-auto shrink-0 tabular-nums text-xs text-foreground-subtle">
              {total > 0 ? `${Math.round((segment.duration / total) * 100)}%` : "0%"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Rough advance width in ems: CJK glyphs fill one, latin, digits and spaces about half. */
function textUnits(text: string): number {
  let units = 0;
  for (const char of text) units += /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef]/.test(char) ? 1 : 0.55;
  return units;
}

/* ── Day timeline strip ──────────────────────────────────────────────── */

export interface StripView {
  from: number;
  to: number;
}

/** Deepest zoom: half an hour, which is where sub-hour ticks start paying off. */
const MIN_VIEW_MS = 30 * 60_000;
const TICK_STEPS = [
  5 * 60_000,
  15 * 60_000,
  30 * 60_000,
  HOUR_MS,
  2 * HOUR_MS,
  3 * HOUR_MS,
  6 * HOUR_MS,
  12 * HOUR_MS,
];

export function TimelineStrip({
  from,
  to,
  segments,
  colorOf,
  formatTooltip,
  formatTick,
  height = 44,
  view,
  onViewChange,
}: {
  from: number;
  to: number;
  segments: Array<{ start: number; end: number; categoryId: string; title: string | null; app: string | null; duration: number }>;
  colorOf: (categoryId: string) => string;
  formatTooltip: (segment: { start: number; end: number; title: string | null; app: string | null; duration: number }) => string;
  /** Axis label for a tick; the caller decides hour vs hour:minute wording. */
  formatTick: (date: Date) => string;
  height?: number;
  /** Visible window; `null` means the whole day. Owned by the caller so several strips can zoom together. */
  view: StripView | null;
  onViewChange: (view: StripView | null) => void;
}) {
  const trackRef = React.useRef<HTMLDivElement | null>(null);
  const drag = React.useRef<{ x: number; from: number } | null>(null);
  const [hovered, setHovered] = React.useState<number | null>(null);

  const dayStart = new Date(new Date(from).setHours(0, 0, 0, 0)).getTime();
  const dayEnd = Math.max(dayStart + HOUR_MS, to);
  const daySpan = dayEnd - dayStart;
  const span = Math.min(daySpan, Math.max(MIN_VIEW_MS, view ? view.to - view.from : daySpan));
  const viewFrom = Math.min(Math.max(view?.from ?? dayStart, dayStart), dayEnd - span);
  const viewTo = viewFrom + span;

  const pctOf = (ms: number) => ((ms - viewFrom) / span) * 100;
  const step = TICK_STEPS.find((size) => span / size <= 8) ?? TICK_STEPS[TICK_STEPS.length - 1];
  const ticks: number[] = [];
  for (let tick = Math.ceil(viewFrom / step) * step; tick <= viewTo; tick += step) ticks.push(tick);

  const moveWindow = (start: number, width: number) => {
    // A window as wide as the day is the default view, so keep it as `null` rather
    // than a state that only looks zoomed and offers a pointless reset.
    if (width >= daySpan) {
      onViewChange(null);
      return;
    }
    const clamped = Math.min(Math.max(start, dayStart), dayEnd - width);
    onViewChange({ from: clamped, to: clamped + width });
  };

  // React registers `wheel` passively, so zooming needs a native non-passive listener.
  React.useEffect(() => {
    const node = trackRef.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = node.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / Math.max(1, rect.width)));
      const next = Math.min(daySpan, Math.max(MIN_VIEW_MS, span * (event.deltaY > 0 ? 1.25 : 0.8)));
      moveWindow(viewFrom + span * ratio - next * ratio, next);
    };
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewFrom, span, dayStart, dayEnd]);

  // One bubble for the whole strip: a tooltip per segment keeps showing the first
  // one while the pointer slides across neighbours, and a day can hold hundreds.
  const active = hovered != null ? segments[hovered] : undefined;
  const activeLeft = active ? Math.min(90, Math.max(10, pctOf(active.start) + Math.max(0.15, ((active.end - active.start) / span) * 100) / 2)) : 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative" style={{ height }}>
        <div
          ref={trackRef}
          className="absolute inset-0 select-none overflow-hidden rounded-md border border-border bg-hover"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            // Without this the browser starts a native drag/selection over the bands,
            // which shows the "not allowed" cursor and swallows our pointer moves.
            event.preventDefault();
            drag.current = { x: event.clientX, from: viewFrom };
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            const current = drag.current;
            if (!current) return;
            const rect = event.currentTarget.getBoundingClientRect();
            moveWindow(current.from + ((current.x - event.clientX) / Math.max(1, rect.width)) * span, span);
          }}
          onPointerUp={(event) => {
            drag.current = null;
            event.currentTarget.releasePointerCapture(event.pointerId);
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
          onDoubleClick={() => onViewChange(null)}
        >
          {ticks.map((tick) => (
            <span key={tick} className="absolute top-0 h-full w-px bg-border" style={{ left: `${pctOf(tick)}%` }} />
          ))}
          {segments.map((segment, index) => (
            <span
              key={`${segment.start}-${index}`}
              onMouseEnter={() => setHovered(index)}
              onMouseLeave={() => setHovered((current) => (current === index ? null : current))}
              className="absolute top-1/2 h-6 -translate-y-1/2 rounded-[2px] transition-[height] duration-150 hover:h-8"
              style={{
                left: `${pctOf(segment.start)}%`,
                width: `${Math.max(0.15, ((segment.end - segment.start) / span) * 100)}%`,
                background: colorOf(segment.categoryId),
              }}
            />
          ))}
        </div>

        {active ? (
          <div
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-0 z-[100] mb-1.5 max-w-[280px] -translate-x-1/2 animate-fade-in whitespace-pre-line rounded-lg border border-border bg-surface p-3 text-xs leading-relaxed text-foreground shadow-pop"
            style={{ left: `${activeLeft}%` }}
          >
            {formatTooltip(active)}
          </div>
        ) : null}
      </div>

      <div className="relative h-3.5 text-[10px] tabular-nums text-foreground-faint">
        {ticks.map((tick) => (
          <span key={tick} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${pctOf(tick)}%` }}>
            {formatTick(new Date(tick))}
          </span>
        ))}
      </div>
    </div>
  );
}
