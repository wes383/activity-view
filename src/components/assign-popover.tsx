"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Loader2, Plus } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { apiFetch } from "@/lib/client/api";
import { useApi } from "@/lib/hooks";
import { chartColor, cn, truncate } from "@/lib/utils";
import type { Settings } from "@/lib/core/settings";

/** A top app or host that currently falls into no category. */
export interface AssignKey {
  key: string;
  kind: "app" | "domain";
}

/**
 * Click an uncategorized app or host and pick a category: a substring rule for it
 * is appended to that category straight into the settings.
 */
export function AssignPopover({
  item,
  duration,
  className,
  onAssigned,
}: {
  item: AssignKey;
  /** Pre-formatted duration, so the chip matches its row. */
  duration: string;
  className?: string;
  onAssigned: () => void;
}) {
  const { d, lang } = useLanguage();
  const settings = useApi<{ settings: Settings }>("/api/settings");
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const categories = (settings.data?.settings.categories ?? []).filter((category) => category.enabled);

  const assign = async (categoryId: string) => {
    setPending(categoryId);
    setError(null);
    try {
      const res = await apiFetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: item.key, kind: item.kind, categoryId }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? `HTTP ${res.status}`);
      }
      setOpen(false);
      settings.mutate();
      onAssigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPending(null);
    }
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={`${d.categories.assign} ${item.key}`}
          className={cn(
            // Negative margins cancel the hover box's own padding, so chips sit in a
            // wrapped row exactly like the plain text items next to them.
            "group -mx-1 -my-0.5 inline-flex max-w-full cursor-pointer items-center gap-1 rounded-md px-1 py-0.5 text-xs text-foreground-muted transition-colors hover:bg-hover hover:text-foreground",
            className
          )}
        >
          <span className="truncate">{truncate(item.key, 30)}</span>
          <span className="shrink-0 tabular-nums text-foreground-subtle">{duration}</span>
          <Plus className="h-3 w-3 shrink-0 opacity-0 transition-opacity group-hover:opacity-70" aria-hidden="true" />
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          className="z-[100] w-64 animate-fade-slide-in rounded-lg border border-border bg-surface p-1 text-foreground shadow-pop outline-none"
        >
          <p className="px-2.5 py-1.5 text-xs font-medium text-foreground-subtle">{d.categories.assign}</p>

          <div className="flex max-h-56 flex-col overflow-y-auto">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                disabled={pending !== null}
                onClick={() => void assign(category.id)}
                className="flex w-full cursor-pointer select-none items-center gap-2 rounded-md px-2.5 py-2 text-sm transition-colors hover:bg-hover disabled:pointer-events-none disabled:opacity-50"
              >
                <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: chartColor(category.color) }} />
                <span className="truncate">{category.label[lang]}</span>
                {pending === category.id ? (
                  <Loader2 className="ml-auto h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
                ) : (
                  <span className="ml-auto shrink-0 text-[11px] tabular-nums text-foreground-subtle">
                    {category.weight.toFixed(2)}
                  </span>
                )}
              </button>
            ))}
            {settings.isLoading && !settings.data ? (
              <p className="px-2.5 py-2 text-xs text-foreground-subtle">{d.ui.loading}</p>
            ) : null}
          </div>

          <p className="px-2.5 pb-1 text-[11px] leading-snug text-foreground-subtle">
            {error ? <span className="text-red-fg">{error}</span> : d.categories.assignHint}
          </p>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
