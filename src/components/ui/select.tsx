"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
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
          // `focus-visible`, not `focus`: Radix hands focus back to the trigger after
          // a selection, so a plain `focus:` border would darken the button every
          // time you pick an option — mouse users read that as a stray outline.
          "flex w-full cursor-pointer items-center justify-between border border-border bg-surface text-foreground placeholder:text-foreground-subtle transition-colors duration-150 focus:outline-none focus-visible:border-border-strong disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 [&>span]:text-left",
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
          <SelectPrimitive.ScrollUpButton
            className="flex cursor-default items-center justify-center py-1 text-foreground-subtle"
          >
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          </SelectPrimitive.ScrollUpButton>
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
          <SelectPrimitive.ScrollDownButton
            className="flex cursor-default items-center justify-center py-1 text-foreground-subtle"
          >
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
