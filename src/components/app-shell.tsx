"use client";

import { useLayoutEffect, useRef, useState, type Ref } from "react";
import { BarChart3, ChartGantt, Layers, LineChart, Menu, Settings } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { useLanguage } from "@/components/language-provider";
import { useRange } from "@/components/range-provider";
import { useMounted } from "@/lib/hooks";
import { cn, toDayKey } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
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

/** `gap-1.5` between the period picker and the custom-range fields. */
const FIELD_GAP = 6;

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
  const pathname = useLocation().pathname;
  const range = useRange();
  const mounted = useMounted();

  /** Settings and the timeline resolve their own period, so they drop the picker. */
  const usesRange = pathname === "/" || pathname.startsWith("/categories") || pathname.startsWith("/trends");
  const showCustomRow = usesRange && range.key === "custom";

  // The custom range adds two date fields. They sit beside the picker whenever the
  // header has room for them — which is a different amount of room in each bar, since
  // the desktop one also has to keep the tabs centred — and drop to a row of their own
  // otherwise. Measured rather than guessed with a breakpoint.
  const barRef = useRef<HTMLDivElement>(null);
  const mobileBarRef = useRef<HTMLElement>(null);
  const tabsRef = useRef<HTMLElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  // One copy per possible home. Only one is ever laid out, so the widths are read in
  // order and the first one with a box wins.
  const fieldsBarRef = useRef<HTMLDivElement>(null);
  const fieldsMobileRef = useRef<HTMLDivElement>(null);
  const fieldsRowRef = useRef<HTMLDivElement>(null);
  const [inlineFields, setInlineFields] = useState(true);

  useLayoutEffect(() => {
    /** Every copy renders the same two fields, so any laid-out one gives the width. */
    const fieldsWidth = () =>
      fieldsRowRef.current?.offsetWidth ||
      fieldsBarRef.current?.offsetWidth ||
      fieldsMobileRef.current?.offsetWidth ||
      0;

    /** Desktop: the fields share the left track with the picker, and that track is
     *  half of what the centred tabs leave over. */
    const fitsDesktop = (): boolean | null => {
      const bar = barRef.current;
      const tabs = tabsRef.current;
      if (!bar || !tabs || bar.clientWidth === 0) return null;
      const style = getComputedStyle(bar);
      const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const gap = parseFloat(style.columnGap || "0");
      const track = (bar.clientWidth - padding - tabs.offsetWidth - gap * 2) / 2;
      const picker = pickerRef.current?.offsetWidth ?? 0;
      return picker + FIELD_GAP + fieldsWidth() <= track;
    };

    /** Phone: a plain flex row, so the fields fit when the row still adds up. Summing
     *  the other children keeps the menu and status button widths out of the maths. */
    const fitsMobile = (): boolean | null => {
      const bar = mobileBarRef.current;
      if (!bar || bar.clientWidth === 0) return null;
      const style = getComputedStyle(bar);
      const padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
      const gap = parseFloat(style.columnGap || "0");
      const others = Array.from(bar.children).filter(
        // `#header-lead` is `display: contents`, and the fields themselves move in and
        // out of this row — neither contributes a box of its own.
        (el) => el.id !== "header-lead" && el !== fieldsMobileRef.current
      );
      const widths = others.reduce((sum, el) => sum + el.getBoundingClientRect().width, 0);
      return widths + fieldsWidth() + gap * others.length <= bar.clientWidth - padding;
    };

    const measure = () => setInlineFields(fitsDesktop() ?? fitsMobile() ?? true);

    measure();
    // The picker and the tabs both change width with the label (and with the
    // language), so watching the bars alone would miss those.
    const observer = new ResizeObserver(measure);
    for (const node of [barRef.current, mobileBarRef.current, tabsRef.current, pickerRef.current]) {
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, [usesRange, range.key]);

  return (
    <div className="flex min-h-dvh flex-col">
      <header
        ref={mobileBarRef}
        className="sticky top-0 z-30 flex items-center gap-2 border-b border-border bg-sidebar/95 px-3 py-3 backdrop-blur lg:hidden"
      >
        <Drawer>
          <DrawerTrigger asChild>
            <Button variant="ghost" size="icon" aria-label={d.ui.menu} className="shrink-0">
              <Menu className="h-4 w-4" aria-hidden="true" />
            </Button>
          </DrawerTrigger>
          <DrawerContent aria-label={d.app.name} closeLabel={d.ui.close} className="w-[220px]">
            <SidebarNav pathname={pathname} />
          </DrawerContent>
        </Drawer>

        {/* Sits beside the menu button rather than on its own row, which keeps the
            whole top of the app to a single line on a phone. */}
        {usesRange ? <RangeSelect className="w-auto shrink-0" /> : null}

        {/* Page-level controls portal themselves in here on phones, the same way the
            desktop bar exposes `#toolbar-lead`. Only one of the two is ever visible,
            so the pages can render both without duplicating state. */}
        <div id="header-lead" className="contents" />

        {/* No tabs on a phone, so the custom range's fields get a shot at this row
            before they are pushed onto a row of their own. */}
        {showCustomRow && inlineFields ? <CustomRangeInputs innerRef={fieldsMobileRef} /> : null}

        {/* Just the status dot: the pill's surface and border are desktop chrome,
            and the dot alone is enough of a signal on a phone. Refresh lives in the
            ActivityWatch card, so no standalone button here. */}
        <div className="ml-auto flex shrink-0 items-center">
          <AwIndicator className="h-9 w-9 justify-center rounded-none border-0 bg-transparent px-0" />
        </div>
      </header>

      {/* Desktop navigation: one bar holding the period controls on the left, the five
          destinations as centred tabs, and the status pill on the right.

          The outer two columns are equal `minmax(0, 1fr)` tracks rather than
          auto-sized, so the middle track is always centred in the bar and the tabs
          never move when the left slot changes width. Content that outgrows its track
          is clipped for the one frame it takes the measurement below to react. */}
      <header className="sticky top-0 z-40 hidden border-b border-border bg-background/90 backdrop-blur lg:block">
        <div
          ref={barRef}
          className="grid h-14 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 px-6"
        >
          <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
            {/* The timeline's day picker portals in here, ahead of the period picker. */}
            <div id="toolbar-lead" className="contents" />
            {/* `w-auto`: the trigger sizes to its label, so short ranges do not leave
                a gap between the text and the chevron. Measured below, not assumed. */}
            {usesRange ? (
              <div ref={pickerRef} className="shrink-0">
                <RangeSelect className="w-auto" />
              </div>
            ) : null}
            {showCustomRow && inlineFields ? <CustomRangeInputs innerRef={fieldsBarRef} /> : null}
          </div>
          <TopTabs pathname={pathname} innerRef={tabsRef} />
          <div className="flex items-center justify-end">
            <AwIndicator />
          </div>
        </div>
      </header>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Sticky under whichever header is showing: `top-16` below `lg` (h-10 controls
            plus `py-3`), `top-14` above. */}
        {mounted && showCustomRow && !inlineFields ? (
          <div className="sticky top-16 z-20 flex items-center gap-2 border-b border-border bg-background/90 px-4 py-3 backdrop-blur lg:top-14 lg:px-6">
            <CustomRangeInputs innerRef={fieldsRowRef} />
          </div>
        ) : null}

        <main className="flex-1 px-4 pb-12 pt-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

/**
 * The period picker. Rendered twice — in the mobile header and in the desktop bar —
 * because the two bars never coexist. Both read the same range context, so they
 * cannot drift apart.
 */
function RangeSelect({ className }: { className?: string }) {
  const { d } = useLanguage();
  const range = useRange();
  return (
    <Select
      className={className}
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
      options={RANGE_OPTIONS.map(({ key, label }) => ({ value: key, label: d.range[label] }))}
    />
  );
}

const DATE_FIELD =
  "h-10 cursor-pointer rounded-lg border border-border bg-surface px-3 text-sm text-foreground transition-colors duration-150 focus:border-border-strong focus:outline-none";

/** The two fields the custom range needs. The bar measures this node to decide whether
 *  the fields fit beside the picker or have to take a row of their own. */
function CustomRangeInputs({ innerRef }: { innerRef?: Ref<HTMLDivElement> }) {
  const { d } = useLanguage();
  const range = useRange();
  return (
    // `shrink-0` keeps `offsetWidth` at the natural width even when the bar's track is
    // too narrow — otherwise flex would compress the fields and the measurement would
    // wrongly conclude they still fit.
    <div ref={innerRef} className="flex shrink-0 items-center gap-1.5">
      <input
        type="date"
        aria-label={d.range.from}
        value={range.from}
        max={range.to}
        onChange={(event) => range.setCustom(event.target.value, range.to)}
        className={DATE_FIELD}
      />
      <span className="text-xs text-foreground-subtle">→</span>
      <input
        type="date"
        aria-label={d.range.to}
        value={range.to}
        min={range.from}
        onChange={(event) => range.setCustom(range.from, event.target.value)}
        className={DATE_FIELD}
      />
    </div>
  );
}

/**
 * Desktop navigation: the same five destinations as the drawer, laid out as tabs.
 * The bar's middle grid track sizes to this content, so the tabs sit dead centre
 * without any `flex-1` trickery.
 */
function TopTabs({ pathname, innerRef }: { pathname: string; innerRef?: Ref<HTMLElement> }) {
  const { d } = useLanguage();
  return (
    <nav ref={innerRef} aria-label={d.app.name} className="flex items-center justify-center gap-1">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            to={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "cursor-pointer whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors",
              // Grey chip rather than the inverse `accent`: a top bar is chrome, and a
              // solid dark pill up there competes with the content below it.
              active
                ? "bg-hover-strong text-foreground"
                : "text-foreground-muted hover:bg-hover hover:text-foreground"
            )}
          >
            {d.nav[item.labelKey]}
          </Link>
        );
      })}
    </nav>
  );
}

/** The mobile drawer's nav. */
function SidebarNav({ pathname }: { pathname: string }) {
  const { d } = useLanguage();
  return (
    // The close button floats at `top-3` and is 32px tall, so the first group has to
    // start below 44px — otherwise its hover halo nearly touches the first nav item.
    <div className="flex flex-1 flex-col gap-6 px-3 pt-14 pb-4">
      <NavGroup label={d.nav.analysis} items={NAV.slice(0, 4)} pathname={pathname} />
      <NavGroup label={d.nav.config} items={NAV.slice(4)} pathname={pathname} />
    </div>
  );
}

function NavGroup({
  label,
  items,
  pathname,
}: {
  label: string;
  items: ReadonlyArray<(typeof NAV)[number]>;
  pathname: string;
}) {
  const { d } = useLanguage();
  return (
    <div className="flex flex-col gap-1">
      <p className="px-2 pb-1 font-display text-[11px] font-medium tracking-wide text-foreground-subtle">{label}</p>
      {items.map((item) => (
        <SideLink
          key={item.href}
          href={item.href}
          icon={item.icon}
          active={isActive(pathname, item.href)}
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
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  children: React.ReactNode;
}) {
  // `asChild` keeps the link itself as the dismiss trigger, so a tap both navigates
  // and closes the drawer.
  return (
    <DrawerClose asChild>
      <Link
        to={href}
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
    </DrawerClose>
  );
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
