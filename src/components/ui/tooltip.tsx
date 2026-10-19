"use client";

import * as React from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

const TooltipProvider = TooltipPrimitive.Provider;

function Tooltip({ delayDuration = 300, ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return <TooltipPrimitive.Root delayDuration={delayDuration} {...props} />;
}

const TooltipTrigger = TooltipPrimitive.Trigger;

function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          // Surface bubble, not an inverted one: border + shadow keep it readable
          // against a same-coloured panel underneath.
          "z-[100] max-w-xs rounded-md border border-border bg-surface px-2.5 py-1 text-xs font-medium leading-tight text-foreground shadow-md animate-fade-slide-in",
          className
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}

/** One-line hover detail for an existing element — replaces the native `title`. */
function Hint({
  label,
  side,
  multiline,
  children,
}: {
  label: React.ReactNode;
  side?: "top" | "right" | "bottom" | "left";
  /** Lets a `\n`-joined string keep its line breaks. */
  multiline?: boolean;
  children: React.ReactElement;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        className={multiline ? "max-w-[260px] whitespace-pre-line font-normal leading-relaxed" : undefined}
      >
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

export { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent, Hint };
