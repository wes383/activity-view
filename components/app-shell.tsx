"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, ChartGantt, Layers, LineChart, Menu, RefreshCw, Settings } from "lucide-react";
import { useLanguage } from "@/components/language-provider";
import { useRange } from "@/components/range-provider";
import { refreshAll, useMounted } from "@/lib/hooks";
import { cn, toDayKey } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Hint } from "@/components/ui/tooltip";
import { ThemeToggle } from "@/components/theme-toggle";
import { LangToggle } from "@/components/lang-toggle";
import { AwIndicator } from "@/components/aw-indicator";
import { Drawer, DrawerClose, DrawerContent, DrawerTrigger } from "@/components/ui/drawer";
import type { RangeKey } from "@/lib/core/time";
import type { Dict } from "@/lib/i18n";

const NAV = [
  { href: "/", icon: BarChart3, labelKey: "overview" },
  { href: "/categories", icon: Layers, labelKey: "categories" },
  { href: "/timeline", icon: ChartGantt, labelKey: "timeline" },
  { href: "/trends", icon: LineChart, labelKey: "trends" },
  { href: "/settings", icon: Settings, labelKey: "settings" },
] as const;

const RANGE_OPTIONS: Array<{ key: RangeKey; label: keyof Dict["range"] }> = [
  { key: "today", label: "today" },
  { key: "yesterday", label: "yesterday" },
  { key: "week", label: "week" },
  { key: "last-week", label: "lastWeek" },
  { key: "month", label: "month" },
  { key: "last-month", label: "lastMonth" },
  { key: "last-7", label: "last7" },
  { key: "last-30", label: "last30" },
  { key: "year", label: "year" },
  { key: "custom", label: "custom" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const { d } = useLanguage();
  const pathname = usePathname();
  const range = useRange();
  const mounted = useMounted();

  const rangeOptions = RANGE_OPTIONS.map(({ key, label }) => ({ value: key, label: d.range[label] }));
  /** Settings and the timeline resolve their own period, so they drop the picker. */
  const usesRange = pathname === "/" || pathname.startsWith("/categories") || pathname.startsWith("/trends");
  // The timeline portals its own day picker into the same fixed row, so the strip has
  // to exist there too — including below `lg`, where the picker lives nowhere else.
  const usesToolbar = usesRange || pathname.startsWith("/timeline");
  /** A static page with no period and no data: the fixed row would only hold chrome. */
  const barePage = pathname.startsWith("/privacy");

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-sidebar/95 px-4 py-3 backdrop-blur lg:hidden">
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={d.ui.menu}>
              <Menu className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DrawerTrigger>
          <DrawerContent aria-label={d.app.name} closeLabel={d.ui.close} className="w-[220px]">
            <SidebarNav pathname={pathname} dismissible />
          </DrawerContent>
        </Drawer>
        <div className="ml-auto flex items-center gap-1">
          <Hint label={d.ui.refresh}>
            <Button size="icon" variant="ghost" aria-label={d.ui.refresh} onClick={() => refreshAll()}>
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
            </Button>
          </Hint>
          <AwIndicator className="h-9 w-9 justify-center px-0" />
          <LangToggle />
          <ThemeToggle />
        </div>
      </header>

      <aside className="hidden w-[148px] shrink-0 flex-col border-r border-border bg-sidebar lg:sticky lg:top-0 lg:flex lg:h-dvh">
        <SidebarNav pathname={pathname} />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {mounted && !barePage ? (
          <div
            className={cn(
              "sticky top-0 z-20 flex-wrap items-center gap-2 border-b border-border bg-background/90 px-4 py-3 backdrop-blur lg:px-8",
              // Pages without a range picker would leave an empty strip below `lg`,
              // where the mobile header already carries the same controls.
              usesToolbar ? "flex" : "hidden lg:flex"
            )}
          >
            {/* Page-level controls portal themselves in here, left-aligned. */}
            <div id="toolbar-lead" className="contents" />
            {usesRange ? (
              <div className="flex items-center gap-1.5">
                <Select
                  className="w-[150px] lg:w-[168px]"
                  ariaLabel={d.ui.rangeLabel}
                  value={range.key}
                  onChange={(value) => {
                    const key = value as RangeKey;
                    if (key === "custom") {
                      const today = toDayKey(new Date());
                      range.setCustom(range.from || today, range.to || today);
                    } else {
                      range.setKey(key);
                    }
                  }}
                  options={rangeOptions}
                />
                {range.key === "custom" ? (
                  <div className="flex items-center gap-1.5">
                    <input
                      type="date"
                      aria-label={d.range.from}
                      value={range.from}
                      max={range.to}
                      onChange={(event) => range.setCustom(event.target.value, range.to)}
                      className="h-10 cursor-pointer rounded-lg border border-border bg-surface px-3 text-sm text-foreground transition-colors duration-150 focus:border-border-strong focus:outline-none"
                    />
                    <span className="text-xs text-foreground-subtle">→</span>
                    <input
                      type="date"
                      aria-label={d.range.to}
                      value={range.to}
                      min={range.from}
                      onChange={(event) => range.setCustom(range.from, event.target.value)}
                      className="h-10 cursor-pointer rounded-lg border border-border bg-surface px-3 text-sm text-foreground transition-colors duration-150 focus:border-border-strong focus:outline-none"
                    />
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Refresh lives inside the ActivityWatch status card; the mobile header
                keeps its own button because a hover card has no touch equivalent. */}
            <div className="ml-auto hidden items-center gap-1.5 lg:flex">
              <AwIndicator />
              <LangToggle />
              <ThemeToggle />
            </div>
          </div>
        ) : null}

        <main className="flex-1 px-4 pb-12 pt-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

/** Rendered twice: the desktop rail and the mobile drawer. */
function SidebarNav({ pathname, dismissible = false }: { pathname: string; dismissible?: boolean }) {
  const { d } = useLanguage();
  return (
    <>
      <div className="flex flex-1 flex-col gap-6 px-3 pt-5 pb-4">
        <NavGroup label={d.nav.analysis} items={NAV.slice(0, 4)} pathname={pathname} dismissible={dismissible} />
        <NavGroup label={d.nav.config} items={NAV.slice(4)} pathname={pathname} dismissible={dismissible} />
      </div>
      <div className="px-6 py-3">
        <Link
          href="/privacy"
          className="inline-flex cursor-pointer text-[11px] text-foreground-subtle transition-colors hover:text-foreground"
        >
          {d.privacy.title}
        </Link>
      </div>
    </>
  );
}

function NavGroup({
  label,
  items,
  pathname,
  dismissible,
}: {
  label: string;
  items: ReadonlyArray<(typeof NAV)[number]>;
  pathname: string;
  dismissible: boolean;
}) {
  const { d } = useLanguage();
  return (
    <div className="flex flex-col gap-1">
      <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-foreground-subtle">{label}</p>
      {items.map((item) => (
        <SideLink
          key={item.href}
          href={item.href}
          icon={item.icon}
          active={isActive(pathname, item.href)}
          dismissible={dismissible}
        >
          {d.nav[item.labelKey]}
        </SideLink>
      ))}
    </div>
  );
}

function SideLink({
  href,
  icon: Icon,
  active,
  children,
  dismissible = false,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  children: React.ReactNode;
  dismissible?: boolean;
}) {
  const link = (
    <Link
      href={href}
      prefetch
      className={cn(
        "flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-accent text-accent-fg"
          : "text-foreground-muted hover:bg-hover hover:text-foreground"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span className="truncate">{children}</span>
    </Link>
  );

  // `asChild` keeps the link itself as the dismiss trigger, so a tap both navigates and closes.
  return dismissible ? <DrawerClose asChild>{link}</DrawerClose> : link;
}

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight">{title}</h1>
        {description ? <p className="max-w-2xl text-sm text-foreground-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
