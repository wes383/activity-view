"use client";

import * as React from "react";
import { AlertTriangle, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/language-provider";

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse-soft rounded-md bg-hover-strong", className)} {...props} />;
}

export function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-3 p-5", className)}>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3">
          <Skeleton className="h-4 w-4 shrink-0 rounded-full" />
          <Skeleton className="h-3 flex-1" />
          <Skeleton className="h-3 w-12 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function Progress({
  value,
  color,
  className,
  height = "h-2",
}: {
  value: number;
  color?: string;
  className?: string;
  height?: string;
}) {
  const clamped = Math.min(100, Math.max(0, value));
  return (
    <div className={cn("w-full overflow-hidden rounded-full bg-hover-strong", height, className)}>
      <div
        className="h-full rounded-full transition-all duration-200 ease-out"
        style={{ width: `${clamped}%`, background: color ?? "var(--accent)" }}
      />
    </div>
  );
}

export function EmptyState({
  title,
  description,
  icon,
  className,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center p-8 text-center", className)}>
      <div className="mb-3 flex h-10 w-10 items-center justify-center text-foreground-faint">
        {icon ?? <Inbox className="h-8 w-8" aria-hidden="true" />}
      </div>
      <h3 className="font-display text-lg font-semibold tracking-tight">{title}</h3>
      {description ? <p className="mt-2 max-w-md text-sm text-foreground-muted">{description}</p> : null}
    </div>
  );
}

/** Uniform loading / error / empty handling for every analytics panel. */
export function DataState({
  isLoading,
  error,
  isEmpty,
  emptyTitle,
  emptyDescription,
  skeleton,
  children,
}: {
  isLoading: boolean;
  error?: unknown;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  skeleton?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { d } = useLanguage();

  if (isLoading || !children) {
    return <>{skeleton ?? <SkeletonRows rows={4} />}</>;
  }

  if (error) {
    const code = (error as { code?: string }).code;
    return (
      <div className="flex flex-col items-start gap-3 rounded-lg border border-red-border bg-red-soft p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-red-fg">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          {code === "aw_unreachable" ? d.status.disconnected : d.settings.statusFail}
        </div>
        <p className="text-xs text-foreground-muted">
          {code === "aw_unreachable" ? d.status.disconnectedHint : (error as { message?: string }).message}
        </p>
      </div>
    );
  }

  if (isEmpty) {
    return <EmptyState title={emptyTitle ?? d.ui.noData} description={emptyDescription ?? d.ui.noDataHint} />;
  }

  return <>{children}</>;
}
