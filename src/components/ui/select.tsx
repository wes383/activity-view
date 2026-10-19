"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const TRIGGER_SIZES = {
  xs: "h-8 gap-1.5 px-2.5 py-1 text-xs rounded-md",
  sm: "h-10 gap-2 px-3 py-2 text-sm rounded-lg",
  md: "h-12 gap-2 px-4 py-2 text-sm rounded-lg",
  lg: "h-14 gap-2 px-5 py-2.5 text-base rounded-lg",
} as const;

export type SelectSize = keyof typeof TRIGGER_SIZES;

export function Select({
  className,
  value,
  onChange,
  options,
  ariaLabel,
  size = "sm",
}: {
  className?: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  ariaLabel: string;
  size?: SelectSize;
}) {
  return (
    <SelectPrimitive.Root value={value} onValueChange={onChange}>
      <SelectPrimitive.Trigger
        aria-label={ariaLabel}
        className={cn(
          // No focus ring and no open-state highlight: the border stays `--border` for
          // the trigger's whole life. Radix always returns focus to the trigger when the
          // menu closes, and Chromium can classify that programmatic focus as
          // `:focus-visible`, so any focus-driven border left a stray ring behind after
          // a pick. `data-state` fixed that, but a border that darkens on open still
          // reads as the button gaining an outline — the open menu is signal enough.
          "flex w-full cursor-pointer items-center justify-between border border-border bg-surface text-foreground placeholder:text-foreground-subtle transition-colors duration-150 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 [&>span]:text-left",
          TRIGGER_SIZES[size],
          className
        )}
      >
        <SelectPrimitive.Value />
        <SelectPrimitive.Icon asChild>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-60" aria-hidden="true" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className={cn(
            "relative max-h-80 min-w-[8rem] overflow-hidden rounded-lg border border-border bg-surface p-1 text-foreground shadow-pop",
            "data-[state=open]:animate-fade-in data-[state=closed]:animate-none",
            "!z-[100]"
          )}
        >
          {/* No `ScrollUpButton` / `ScrollDownButton`: the viewport already gets a
              native scrollbar when the list overflows, and showing both the arrows and
              the bar reads as two competing affordances. */}
          <SelectPrimitive.Viewport className="w-full p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={option.value}
                value={option.value}
                className={cn(
                  "relative flex w-full cursor-pointer select-none items-center rounded-md py-2 pl-9 pr-3 text-sm text-foreground outline-none transition-colors",
                  "data-[highlighted]:bg-hover data-[state=checked]:font-medium data-[disabled]:pointer-events-none data-[disabled]:opacity-50"
                )}
              >
                <span className="absolute left-3 flex h-3.5 w-3.5 items-center justify-center">
                  <SelectPrimitive.ItemIndicator>
                    <Check className="h-4 w-4 text-accent" strokeWidth={3} aria-hidden="true" />
                  </SelectPrimitive.ItemIndicator>
                </span>
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
