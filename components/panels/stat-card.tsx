"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  trend,
  accent,
  className,
}: {
  label: string;
  value: string;
  hint?: string;
  trend?: { value: number; good?: boolean } | null;
  accent?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5 rounded-lg border border-border bg-surface p-5", className)}>
      <div className="flex items-center gap-2">
        {accent ? <span className="h-2 w-2 rounded-full" style={{ background: accent }} /> : null}
        <span className="text-xs font-medium uppercase tracking-wide text-foreground-subtle">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="font-display text-3xl font-semibold leading-none tabular-nums tracking-tight">{value}</span>
        {trend ? (
          <span
            className={cn(
              "text-xs font-medium tabular-nums",
              trend.value >= 0 ? "text-green-fg" : "text-red-fg"
            )}
          >
            {trend.value >= 0 ? "↑" : "↓"} {Math.abs(trend.value).toFixed(1)}%
          </span>
        ) : null}
      </div>
      {hint ? <span className="text-xs text-foreground-muted">{hint}</span> : null}
    </div>
  );
}

export function MetricRow({ items }: { items: Array<{ label: string; value: React.ReactNode; tone?: string }> }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-0.5">
          <dt className="text-[11px] uppercase tracking-wide text-foreground-subtle">{item.label}</dt>
          <dd className={cn("text-base font-medium tabular-nums", item.tone)}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
