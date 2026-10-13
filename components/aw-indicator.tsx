"use client";

import { RefreshCw } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { refreshAll, useNow, useStatus } from "@/lib/hooks";
import { cn, relativeTime } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import type { ServerStatus } from "@/lib/aw/client";

const STALE_MS = 15 * 60 * 1000;

export function AwIndicator({ className }: { className?: string }) {
  const { d, lang } = useLanguage();
  const status = useStatus<ServerStatus>();
  const now = useNow(30_000);

  const data = status.data;
  const reachable = Boolean(data?.ok);
  const latest = data?.latestEvent ?? null;
  const stale = reachable && latest != null && now != null && now - latest > STALE_MS;
  const noWatchers = reachable && (data?.watchers.length ?? 0) === 0;

  const tone = !reachable || stale || noWatchers ? (reachable ? "bg-orange" : "bg-red-solid") : "bg-green";

  return (
    <HoverCard>
      <HoverCardTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-2 rounded-full border border-border bg-surface px-2.5 py-1",
            className
          )}
        >
          <span className="relative flex h-2 w-2">
            {status.isLoading ? (
              <span className={cn("absolute inline-flex h-full w-full animate-ping rounded-full opacity-60", tone)} />
            ) : null}
            <span className={cn("relative inline-flex h-2 w-2 rounded-full", tone)} />
          </span>
          <span className="hidden text-xs text-foreground-muted lg:inline">
            {reachable ? (data?.hostname ?? "ActivityWatch") : d.status.disconnected}
          </span>
        </span>
      </HoverCardTrigger>

      <HoverCardContent align="end" className="w-64 p-3">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", tone)} />
            <span className="text-xs font-medium text-foreground">
              {reachable ? d.status.connected : d.status.disconnected}
            </span>
          </div>
          {reachable ? (
            <div className="flex flex-col gap-1">
              <Row label={d.settings.version} value={data?.version ?? "—"} />
              <Row label={d.settings.hostname} value={data?.hostname ?? "—"} />
              <Row label={d.settings.watchers} value={String(data?.watchers.length ?? 0)} />
              <Row
                label={d.settings.lastEvent}
                value={now != null && latest != null ? relativeTime(latest, lang, now) : "—"}
              />
            </div>
          ) : (
            <p className="break-words text-xs text-foreground-muted">{data?.error ?? d.status.checking}</p>
          )}
        </div>
        <div className="mt-1.5">
          <Button size="xs" variant="outline" className="w-full" onClick={() => refreshAll()}>
            <RefreshCw className={cn("h-3.5 w-3.5", status.isValidating && "animate-spin")} aria-hidden="true" />
            {d.ui.refresh}
          </Button>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <span className="shrink-0 text-foreground-subtle">{label}</span>
      <span className="ml-auto truncate font-medium tabular-nums text-foreground">{value}</span>
    </div>
  );
}
