"use client";

import * as React from "react";
import { useElementSize } from "@/components/charts/use-size";
import { cn, isAxisTick } from "@/lib/utils";

export interface ChartSeries {
  key: string;
  color: string;
  values: number[];
}

interface HoverState {
  index: number;
  x: number;
}

function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const normalised = rough / magnitude;
  const step = (normalised >= 5 ? 5 : normalised >= 2 ? 2 : 1) * magnitude;
  const ticks: number[] = [];
  for (let value = 0; value <= max + step * 0.5; value += step) ticks.push(value);
  return ticks;
}

/**
 * Multi-series line chart drawn as SVG at the container's exact pixel width,
 * so strokes stay crisp and text is never stretched.
 */
export function LineChart({
  labels,
  series,
  height = 200,
  fill = false,
  formatValue,
  formatLabel,
  formatDetailLabel,
  area = true,
  emptyText,
  showLegend = true,
}: {
  labels: string[];
  series: ChartSeries[];
  /** Drawing height, or the minimum in `fill` mode. */
  height?: number;
  /** Stretch to the container instead of fixing the height. */
  fill?: boolean;
  formatValue: (value: number) => string;
  formatLabel?: (label: string, index: number) => string;
  /** Hover card text; axes stay terse, so this may carry extra detail like the year. */
  formatDetailLabel?: (label: string, index: number) => string;
  area?: boolean;
  emptyText: string;
  showLegend?: boolean;
}) {
  const [ref, size] = useElementSize<HTMLDivElement>();
  const [hover, setHover] = React.useState<HoverState | null>(null);
  const [hidden, setHidden] = React.useState<Set<string>>(() => new Set());

  const toggle = (key: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const width = Math.max(0, size.width);
  const drawnHeight = fill ? Math.max(height, size.height) : height;
  const padding = { top: 12, right: 12, bottom: 22, left: 44 };
  const innerWidth = Math.max(0, width - padding.left - padding.right);
  const innerHeight = Math.max(0, drawnHeight - padding.top - padding.bottom);

  const pointCount = labels.length;
  const shown = series.filter((s) => !hidden.has(s.key));
  // Scaling follows the visible lines, while the empty state looks at everything.
  const [max, dataMax] = React.useMemo(() => {
    let visible = 0;
    let any = 0;
    for (const s of series) {
      for (const value of s.values) {
        if (value > any) any = value;
        if (!hidden.has(s.key) && value > visible) visible = value;
      }
    }
    return [visible, any];
  }, [series, hidden]);

  const ticks = niceTicks(max);
  const scaleMax = ticks[ticks.length - 1] || 1;

  const xOf = (index: number) =>
    padding.left + (pointCount <= 1 ? innerWidth / 2 : (index / (pointCount - 1)) * innerWidth);
  const yOf = (value: number) => padding.top + innerHeight - (value / scaleMax) * innerHeight;

  const labelStride = Math.max(1, Math.ceil(pointCount / Math.max(2, Math.floor(innerWidth / 68))));

  return (
    <>
      <div
        ref={ref}
        className={cn("relative w-full", fill && "h-full")}
        style={fill ? { minHeight: height } : { height }}
      >
      {pointCount === 0 || dataMax === 0 ? (
        <div className="flex h-full items-center justify-center text-sm text-foreground-subtle">{emptyText}</div>
      ) : null}

      {width > 0 && pointCount > 0 ? (
        <svg
          width={width}
          height={drawnHeight}
          role="img"
          className={cn("overflow-visible", fill && "absolute inset-0")}
          onPointerMove={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            const x = event.clientX - box.left - padding.left;
            const index = Math.round((x / Math.max(1, innerWidth)) * (pointCount - 1));
            setHover({ index: Math.min(pointCount - 1, Math.max(0, index)), x });
          }}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={padding.left}
                x2={padding.left + innerWidth}
                y1={yOf(tick)}
                y2={yOf(tick)}
                stroke="var(--border)"
                strokeWidth={1}
                strokeDasharray={tick === 0 ? undefined : "3 4"}
              />
              <text x={padding.left - 8} y={yOf(tick) + 3.5} textAnchor="end" className="fill-foreground-subtle text-[11px]">
                {formatValue(tick)}
              </text>
            </g>
          ))}

          {shown.map((s) => {
            const points = s.values.map((value, index) => `${xOf(index)},${yOf(value)}`);
            const line = `M ${points.join(" L ")}`;
            const fill = `${line} L ${xOf(s.values.length - 1)},${yOf(0)} L ${xOf(0)},${yOf(0)} Z`;
            return (
              <g key={s.key}>
                {area && shown.length <= 2 ? <path d={fill} fill={s.color} opacity={0.12} /> : null}
                <path d={line} fill="none" stroke={s.color} strokeWidth={1.75} strokeLinejoin="round" strokeLinecap="round" />
                {pointCount <= 40
                  ? s.values.map((value, index) => (
                      <circle key={index} cx={xOf(index)} cy={yOf(value)} r={hover?.index === index ? 3.5 : 2} fill="var(--surface)" stroke={s.color} strokeWidth={1.5} />
                    ))
                  : null}
              </g>
            );
          })}

          {labels.map((label, index) =>
            isAxisTick(index, pointCount, labelStride) ? (
              <text
                key={label + index}
                x={xOf(index)}
                y={drawnHeight - 6}
                textAnchor={index === 0 ? "start" : index === pointCount - 1 ? "end" : "middle"}
                className="fill-foreground-subtle text-[11px]"
              >
                {formatLabel ? formatLabel(label, index) : label}
              </text>
            ) : null
          )}

          {hover ? (
            <line
              x1={xOf(hover.index)}
              x2={xOf(hover.index)}
              y1={padding.top}
              y2={padding.top + innerHeight}
              stroke="var(--border-strong)"
              strokeWidth={1}
            />
          ) : null}
        </svg>
      ) : null}

      {hover && width > 0 ? (
        <div
          className="pointer-events-none absolute top-2 z-[100] max-w-[240px] animate-fade-in rounded-lg border border-border bg-surface p-3 text-xs shadow-pop"
          style={{
            left: Math.min(Math.max(xOf(hover.index) + 10, 4), Math.max(4, width - 170)),
          }}
        >
          <div className="mb-1 font-medium text-foreground-muted">
            {(formatDetailLabel ?? formatLabel)?.(labels[hover.index], hover.index) ?? labels[hover.index]}
          </div>
          {shown.map((s) => (
            <div key={s.key} className="flex items-center gap-2 whitespace-nowrap">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.color }} />
              <span className="truncate text-foreground-muted">{s.key}</span>
              <span className="ml-auto font-medium tabular-nums text-foreground">
                {formatValue(s.values[hover.index] ?? 0)}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      </div>

      {showLegend && series.length > 1 ? (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {series.map((s) => {
            const off = hidden.has(s.key);
            return (
              <button
                key={s.key}
                type="button"
                aria-pressed={!off}
                onClick={() => toggle(s.key)}
                className={cn(
                  "inline-flex cursor-pointer items-center gap-1.5 text-xs transition-colors",
                  off ? "text-foreground-faint" : "text-foreground-muted hover:text-foreground"
                )}
              >
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{
                    background: off ? "transparent" : s.color,
                    boxShadow: off ? `inset 0 0 0 1.5px ${s.color}` : undefined,
                  }}
                />
                {s.key}
              </button>
            );
          })}
        </div>
      ) : null}
    </>
  );
}
