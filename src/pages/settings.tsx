"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useTheme } from "next-themes";
import { Link } from "react-router-dom";
import { useLanguage } from "@/components/language-provider";
import { apiFetch } from "@/lib/client/api";
import { useApi, refreshAll, useMounted } from "@/lib/hooks";
import { PageHeader } from "@/components/app-shell";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/display";
import { Checkbox, Segmented, Switch, TextInput } from "@/components/ui/controls";
import { Select } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Hint } from "@/components/ui/tooltip";
import {
  Popconfirm,
  PopconfirmContent,
  PopconfirmDescription,
  PopconfirmTitle,
  PopconfirmTrigger,
} from "@/components/ui/popconfirm";
import { chartColor, cn } from "@/lib/utils";
import type { Category, RuleCondition, Settings } from "@/lib/core/settings";
import type { ServerStatus } from "@/lib/aw/client";

const FIELDS: RuleCondition["field"][] = ["app", "title", "domain", "any"];

interface SettingsResponse {
  settings: Settings;
  persisted: boolean;
  defaults: Settings;
}

export default function SettingsPage() {
  const { d } = useLanguage();
  const { data, error, isLoading } = useApi<SettingsResponse>("/api/settings");

  if (isLoading && !data) {
    return (
      <div className="flex flex-col gap-4">
        <AppearanceCard />
        <Skeleton className="h-[180px] rounded-lg" />
        <Skeleton className="h-[240px] rounded-lg" />
        <PrivacyLink />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col gap-4">
        <AppearanceCard />
        <Card className="border-red-border bg-red-soft p-5 text-sm text-red-fg">
          {error instanceof Error ? error.message : d.status.disconnectedHint}
        </Card>
        <PrivacyLink />
      </div>
    );
  }

  return <SettingsEditor initial={data.settings} defaults={data.defaults} persisted={data.persisted} />;
}

type ThemeChoice = "light" | "dark" | "system";

/**
 * Language and theme are client-side preferences, not ActivityWatch settings,
 * so this card is rendered by every branch of the page — a watcher that is
 * down must not lock the user into the wrong language or theme.
 */
function AppearanceCard() {
  const { d, lang, setLang } = useLanguage();
  const { theme, setTheme } = useTheme();
  const mounted = useMounted();

  // `theme` is undefined until next-themes has read storage on the client.
  const themeChoice: ThemeChoice =
    mounted && (theme === "light" || theme === "dark" || theme === "system") ? theme : "system";

  return (
    <Card>
      <CardHeader title={d.settings.appearance} description={d.settings.appearanceHint} />
      <CardContent className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-10">
        <Preference label={d.settings.language}>
          <Segmented
            ariaLabel={d.settings.language}
            value={lang}
            onChange={setLang}
            options={[
              { value: "zh", label: "中文" },
              { value: "en", label: "English" },
            ]}
          />
        </Preference>
        <Preference label={d.settings.theme}>
          <Segmented
            ariaLabel={d.settings.theme}
            value={themeChoice}
            onChange={setTheme}
            options={[
              { value: "light", label: d.theme.light },
              { value: "dark", label: d.theme.dark },
              { value: "system", label: d.theme.system },
            ]}
          />
        </Preference>
      </CardContent>
    </Card>
  );
}

/**
 * Like `Field`, but not a `<label>`: Segmented renders buttons, and a label
 * wrapping buttons would give them the wrong accessible name.
 *
 * The control sits in its own flex row so it keeps its natural width instead of
 * stretching to the column, which is what used to leave a gap after the last
 * segment.
 */
function Preference({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-foreground-muted">{label}</span>
      <div className="flex">{children}</div>
    </div>
  );
}

/** A static page, so it is reachable from every branch — a watcher that is down
 *  must not hide the one page that needs no data. */
function PrivacyLink() {
  const { d } = useLanguage();
  return (
    <div className="flex justify-center">
      <Link
        to="/privacy"
        className="inline-flex cursor-pointer text-[11px] text-foreground-subtle transition-colors hover:text-foreground"
      >
        {d.privacy.title}
      </Link>
    </div>
  );
}

type SaveState = "idle" | "saving" | "error";

/**
 * Every edit is written through on its own: discrete controls save immediately,
 * while text and number fields only touch local state and flush on blur or
 * Enter, so typing never turns into one request per keystroke.
 */
function SettingsEditor({
  initial,
  defaults,
  persisted,
}: {
  initial: Settings;
  defaults: Settings;
  persisted: boolean;
}) {
  const { d } = useLanguage();
  const status = useApi<ServerStatus>("/api/status");
  const [settings, setSettings] = React.useState<Settings>(initial);
  const [isPersisted, setIsPersisted] = React.useState(persisted);
  const [state, setState] = React.useState<SaveState>("idle");
  const [saveError, setSaveError] = React.useState<string | null>(null);
  const [resetOpen, setResetOpen] = React.useState(false);

  const current = React.useRef<Settings>(initial);
  const unwritten = React.useRef<Settings | null>(null);
  const inFlight = React.useRef(false);
  const queued = React.useRef<Settings | null>(null);

  const write = async (payload: Settings): Promise<void> => {
    if (inFlight.current) {
      queued.current = payload;
      return;
    }
    inFlight.current = true;
    if (unwritten.current === payload) unwritten.current = null;
    setState("saving");
    try {
      const res = await apiFetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => null)) as { settings?: Settings; error?: string } | null;
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      // The route normalises what it stored; mirror that back unless the user
      // has already moved on to another edit. A blank rule row lives only in the
      // UI — the sanitizer drops it — so adopting the response would erase the
      // row the user is still filling in.
      if (body?.settings && current.current === payload && !hasBlankRule(payload)) {
        current.current = body.settings;
        setSettings(body.settings);
      }
      setIsPersisted(true);
      setSaveError(null);
      setState("idle");
      status.mutate();
      await refreshAll();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
      setState("error");
    } finally {
      inFlight.current = false;
      const pending = queued.current;
      queued.current = null;
      if (pending) void write(pending);
    }
  };

  /** Local change only — store it with `persist()`. */
  const draft = (next: Settings) => {
    current.current = next;
    unwritten.current = next;
    setSettings(next);
  };

  const persist = () => {
    const pending = unwritten.current;
    if (!pending) return;
    unwritten.current = null;
    void write(pending);
  };

  /** Change that is stored right away. */
  const commit = (next: Settings) => {
    draft(next);
    persist();
  };

  const patch = (updates: Partial<Settings>) => commit({ ...current.current, ...updates });
  const patchDraft = (updates: Partial<Settings>) => draft({ ...current.current, ...updates });

  const withCategory = (index: number, updates: Partial<Category>): Settings => ({
    ...current.current,
    categories: current.current.categories.map((category, i) => (i === index ? { ...category, ...updates } : category)),
  });

  const addCategory = () => {
    const existing = current.current.categories;
    const count = existing.length + 1;
    // ids must not collide with a category that still exists, so walk past them.
    const used = new Set(existing.map((category) => category.id));
    let serial = count;
    while (used.has(`custom-${serial}`)) serial += 1;
    // Categories match in order, so the new one leads to win over the existing rules.
    patch({
      categories: [
        {
          id: `custom-${serial}`,
          label: { zh: `新分类 ${count}`, en: `New category ${count}` },
          weight: 0.5,
          color: (count % 19) + 1,
          enabled: true,
          conditions: [],
        },
        ...existing,
      ],
    });
  };

  return (
    <>
      <PageHeader
        title={d.settings.title}
        description={d.settings.description}
        actions={
          <div className="flex items-center gap-2">
            {state === "saving" ? (
              <Badge variant="warning">{d.ui.saving}</Badge>
            ) : state === "error" ? (
              <Hint label={saveError ?? d.settings.saveFailed} side="bottom">
                <Badge variant="danger">{d.settings.saveFailed}</Badge>
              </Hint>
            ) : null}
            <Popconfirm open={resetOpen} onOpenChange={setResetOpen}>
              <PopconfirmTrigger asChild>
                <Button variant="ghost" size="sm">{d.ui.resetDefaults}</Button>
              </PopconfirmTrigger>
              <PopconfirmContent
                align="end"
                aria-label={d.settings.resetTitle}
                destructive
                confirmText={d.ui.confirm}
                cancelText={d.ui.cancel}
                onConfirm={() => {
                  setResetOpen(false);
                  commit(structuredClone(defaults));
                }}
                onCancel={() => setResetOpen(false)}
              >
                <PopconfirmTitle>{d.settings.resetTitle}</PopconfirmTitle>
                <PopconfirmDescription>{d.settings.resetHint}</PopconfirmDescription>
              </PopconfirmContent>
            </Popconfirm>
          </div>
        }
      />

      <div className="flex flex-col gap-4">
        <AppearanceCard />
        <Card>
          <CardHeader
            title={d.settings.connection}
            description={isPersisted ? d.settings.savedAt : d.settings.notPersisted}
          />
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={d.settings.awHost} hint={d.settings.awHostHint}>
                <TextInput
                  value={settings.awHost}
                  onChange={(event) => patchDraft({ awHost: event.target.value })}
                  onBlur={persist}
                  onKeyDown={(event) => persistOnEnter(event, persist)}
                  placeholder="http://127.0.0.1:5600"
                  spellCheck={false}
                />
              </Field>
              <Field label={d.settings.hostname} hint={d.settings.hostnameHint}>
                <TextInput
                  value={settings.hostname ?? ""}
                  onChange={(event) => patchDraft({ hostname: event.target.value || null })}
                  onBlur={persist}
                  onKeyDown={(event) => persistOnEnter(event, persist)}
                  placeholder={status.data?.hostname ?? "auto"}
                  spellCheck={false}
                />
              </Field>
            </div>

            <Switch
              checked={settings.excludeAfk}
              onChange={(next) => patch({ excludeAfk: next })}
              label={d.settings.excludeAfk}
            />

            <div className="flex flex-wrap items-center gap-3 rounded-md border border-border bg-sidebar p-3">
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full",
                  status.data?.ok ? "bg-green" : status.data ? "bg-red-solid" : "bg-foreground-faint"
                )}
              />
              <span className="text-sm font-medium">
                {status.data?.ok ? d.settings.statusOk : status.data ? d.settings.statusFail : d.status.checking}
              </span>
              {status.data?.ok ? (
                <>
                  <Badge variant="outline">
                    {d.settings.version} {status.data.version}
                  </Badge>
                  <Badge variant="outline">
                    {status.data.hostname} · {status.data.watchers.length} {d.settings.watchers}
                  </Badge>
                </>
              ) : (
                <span className="text-xs text-foreground-muted">{status.data?.error}</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader title={d.settings.thresholds} />
          <CardContent className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Field label={d.settings.minEvent}>
              <NumberInput
                value={settings.minEventSec}
                min={0}
                max={600}
                onCommit={persist}
                onChange={(value) => patchDraft({ minEventSec: value })}
              />
            </Field>
            <Field label={d.settings.gapTolerance}>
              <NumberInput
                value={settings.gapToleranceSec}
                min={0}
                max={600}
                onCommit={persist}
                onChange={(value) => patchDraft({ gapToleranceSec: value })}
              />
            </Field>
            <Field label={d.settings.breakThreshold}>
              <NumberInput
                value={settings.breakThresholdSec}
                min={30}
                max={7200}
                step={30}
                onCommit={persist}
                onChange={(value) => patchDraft({ breakThresholdSec: value })}
              />
            </Field>
            <Field label={d.settings.sessionMin}>
              <NumberInput
                value={settings.sessionMinSec}
                min={60}
                max={7200}
                step={60}
                onCommit={persist}
                onChange={(value) => patchDraft({ sessionMinSec: value })}
              />
            </Field>
            <Field label={`${d.settings.productiveThreshold} (0–1)`} hint={d.settings.weightHint}>
              <NumberInput
                value={settings.productiveThreshold}
                min={0}
                max={1}
                step={0.05}
                onCommit={persist}
                onChange={(value) => patchDraft({ productiveThreshold: value })}
              />
            </Field>
            <Field label={`${d.settings.uncategorizedWeight} (0–1)`}>
              <NumberInput
                value={settings.uncategorizedWeight}
                min={0}
                max={1}
                step={0.05}
                onCommit={persist}
                onChange={(value) => patchDraft({ uncategorizedWeight: value })}
              />
            </Field>
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            title={d.settings.categoriesTitle}
            description={d.settings.categoriesHint}
            action={
              <Button size="xs" variant="outline" onClick={addCategory}>
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                {d.settings.addCategory}
              </Button>
            }
          />
          <CardContent className="flex flex-col gap-3">
            {settings.categories.map((category, index) => (
              <CategoryEditor
                key={category.id}
                category={category}
                index={index}
                total={settings.categories.length}
                onChange={(updates) => commit(withCategory(index, updates))}
                onDraft={(updates) => draft(withCategory(index, updates))}
                onPersist={persist}
                onMove={(delta) =>
                  commit({ ...current.current, categories: move(current.current.categories, index, index + delta) })
                }
                onDelete={() =>
                  commit({ ...current.current, categories: current.current.categories.filter((_, i) => i !== index) })
                }
              />
            ))}
          </CardContent>
        </Card>
        <PrivacyLink />
      </div>
    </>
  );
}

/** Enter stores a field the way blurring it does; typing itself stays local. */
function persistOnEnter(event: React.KeyboardEvent<HTMLInputElement>, persist: () => void) {
  if (event.key === "Enter") {
    event.preventDefault();
    persist();
  }
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-foreground-muted">{label}</span>
      {children}
      {hint ? <span className="text-[11px] leading-snug text-foreground-subtle">{hint}</span> : null}
    </label>
  );
}

function NumberInput({
  value,
  onChange,
  onCommit,
  min,
  max,
  step = 1,
}: {
  value: number;
  onChange: (value: number) => void;
  onCommit: () => void;
  min: number;
  max: number;
  step?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(event) => {
        const next = Number(event.target.value);
        if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
      }}
      onBlur={onCommit}
      onKeyDown={(event) => persistOnEnter(event, onCommit)}
      className="h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm tabular-nums focus:border-border-strong focus:outline-none"
    />
  );
}

function CategoryEditor({
  category,
  index,
  total,
  onChange,
  onDraft,
  onPersist,
  onMove,
  onDelete,
}: {
  category: Category;
  index: number;
  total: number;
  /** Stored immediately. */
  onChange: (updates: Partial<Category>) => void;
  /** Local only, flushed by `onPersist`. */
  onDraft: (updates: Partial<Category>) => void;
  onPersist: () => void;
  onMove: (delta: number) => void;
  onDelete: () => void;
}) {
  const { d, lang } = useLanguage();
  const [deleteOpen, setDeleteOpen] = React.useState(false);

  const setCondition = (ruleIndex: number, updates: Partial<RuleCondition>, store: boolean) =>
    (store ? onChange : onDraft)({
      conditions: category.conditions.map((condition, i) =>
        i === ruleIndex ? { ...condition, ...updates } : condition
      ),
    });

  return (
    <div className={cn("rounded-md border border-border p-4", !category.enabled && "opacity-60")}>
      <div className="flex flex-wrap items-center gap-2">
        {/* `w-full sm:w-auto` keeps the name field on its own line on phones without
            changing the single-row layout from `sm` upwards. */}
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <span className="w-5 shrink-0 text-[11px] tabular-nums text-foreground-faint">{index + 1}</span>
          <span className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: chartColor(category.color) }} />
          <TextInput
            className="min-w-0 flex-1 sm:w-[150px] sm:flex-none"
            value={category.label[lang]}
            onChange={(event) =>
              onDraft({ label: { ...category.label, [lang]: event.target.value } as Category["label"] })
            }
            onBlur={onPersist}
            onKeyDown={(event) => persistOnEnter(event, onPersist)}
            aria-label={lang === "zh" ? d.settings.labelZh : d.settings.labelEn}
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-foreground-subtle">{d.ui.weight}</span>
          <Slider
            className="w-[110px]"
            ariaLabel={d.ui.weight}
            min={0}
            max={1}
            step={0.05}
            value={[category.weight]}
            onValueChange={([next]) => onDraft({ weight: next })}
            onValueCommit={() => onPersist()}
          />
          <span className="w-9 text-right text-xs tabular-nums">{category.weight.toFixed(2)}</span>
        </div>

        <div className="ml-auto flex items-center gap-1">
          <Checkbox checked={category.enabled} onChange={(next) => onChange({ enabled: next })} label={d.ui.enabled} />
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={d.settings.moveUp}
            disabled={index === 0}
            onClick={() => onMove(-1)}
          >
            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={d.settings.moveDown}
            disabled={index === total - 1}
            onClick={() => onMove(1)}
          >
            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Popconfirm open={deleteOpen} onOpenChange={setDeleteOpen}>
            <PopconfirmTrigger asChild>
              <Button size="icon-sm" variant="ghost" aria-label={d.settings.deleteCategory}>
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </PopconfirmTrigger>
            <PopconfirmContent
              align="end"
              aria-label={d.settings.deleteTitle}
              destructive
              confirmText={d.ui.confirm}
              cancelText={d.ui.cancel}
              onConfirm={() => {
                setDeleteOpen(false);
                onDelete();
              }}
              onCancel={() => setDeleteOpen(false)}
            >
              <PopconfirmTitle>{d.settings.deleteTitle}</PopconfirmTitle>
              <PopconfirmDescription>{d.settings.deleteHint}</PopconfirmDescription>
            </PopconfirmContent>
          </Popconfirm>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {Array.from({ length: 19 }, (_, i) => i + 1).map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`${d.ui.color} ${color}`}
            onClick={() => onChange({ color })}
            className="h-4 w-4 cursor-pointer rounded-[3px] transition-transform hover:scale-110"
            style={{
              background: chartColor(color),
              boxShadow: category.color === color ? "0 0 0 2px var(--ring)" : undefined,
            }}
          />
        ))}
      </div>

      <ul className="mt-3 flex flex-col gap-2">
        {category.conditions.map((condition, ruleIndex) => (
          <li key={ruleIndex} className="flex flex-wrap items-center gap-2">
            <Select
              className="w-[104px] shrink-0"
              ariaLabel={d.ui.rules}
              value={condition.field}
              onChange={(value) => setCondition(ruleIndex, { field: value as RuleCondition["field"] }, true)}
              options={FIELDS.map((field) => ({
                value: field,
                label:
                  field === "app"
                    ? d.settings.fieldApp
                    : field === "title"
                      ? d.settings.fieldTitle
                      : field === "domain"
                        ? d.settings.fieldDomain
                        : d.settings.fieldAny,
              }))}
            />
            <TextInput
              className="min-w-[9rem] flex-1"
              value={condition.pattern}
              spellCheck={false}
              placeholder={condition.regex ? "^chrome" : "chrome"}
              onChange={(event) => setCondition(ruleIndex, { pattern: event.target.value }, false)}
              onBlur={onPersist}
              onKeyDown={(event) => persistOnEnter(event, onPersist)}
            />
            <Checkbox
              checked={!!condition.regex}
              onChange={(next) => setCondition(ruleIndex, { regex: next }, true)}
              label={d.settings.regex}
            />
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={d.ui.remove}
              onClick={() => onChange({ conditions: category.conditions.filter((_, i) => i !== ruleIndex) })}
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </li>
        ))}
        {category.conditions.length === 0 ? (
          <li className="text-xs text-foreground-subtle">{d.settings.noConditions}</li>
        ) : null}
      </ul>

      <Button
        size="xs"
        variant="ghost"
        className="mt-2 self-start"
        onClick={() =>
          onDraft({ conditions: [...category.conditions, { field: "app", pattern: "", regex: false }] })
        }
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        {d.settings.addRule}
      </Button>
    </div>
  );
}

/** A rule with no pattern is still being authored, not something to store. */
function hasBlankRule(settings: Settings): boolean {
  return settings.categories.some((category) =>
    category.conditions.some((condition) => condition.pattern.length === 0)
  );
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
