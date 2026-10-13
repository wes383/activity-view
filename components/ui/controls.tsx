"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<{ value: T; label: React.ReactNode; title?: string }>;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={cn("inline-flex items-center gap-1 rounded-lg bg-hover p-1", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            type="button"
            aria-selected={active}
            title={option.title}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-150",
              active ? "bg-surface text-foreground shadow-xs" : "text-foreground-muted hover:text-foreground"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 py-1">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cn(
          "mt-0.5 inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border transition-colors duration-150",
          checked ? "border-transparent bg-accent" : "border-border bg-hover-strong"
        )}
      >
        <span
          className={cn(
            "h-4 w-4 rounded-full bg-surface shadow-xs transition-transform duration-150",
            checked ? "translate-x-4.5" : "translate-x-0.5"
          )}
        />
      </button>
      <span className="flex flex-col">
        <span className="text-sm font-medium text-foreground">{label}</span>
        {description ? <span className="text-xs text-foreground-muted">{description}</span> : null}
      </span>
    </label>
  );
}

export function TextInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-10 w-full rounded-lg border border-border bg-surface px-3 text-sm text-foreground placeholder:text-foreground-subtle transition-colors duration-150 focus:border-border-strong focus:outline-none",
        className
      )}
      {...props}
    />
  );
}

export function Checkbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="inline-flex cursor-pointer items-center gap-2 text-sm text-foreground"
    >
      <span
        className={cn(
          "flex h-4 w-4 items-center justify-center rounded border transition-colors",
          checked ? "border-accent bg-accent text-accent-fg" : "border-border-strong bg-surface"
        )}
      >
        {checked ? <Check className="h-3 w-3" aria-hidden="true" /> : null}
      </span>
      {label}
    </button>
  );
}
