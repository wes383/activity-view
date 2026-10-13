"use client";

import * as React from "react";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import { cn } from "@/lib/utils";

/** Block-level hover detail: a tooltip is one line, a hover card is a panel. */
function HoverCard({
  openDelay = 300,
  closeDelay = 120,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Root>) {
  return <HoverCardPrimitive.Root openDelay={openDelay} closeDelay={closeDelay} {...props} />;
}

const HoverCardTrigger = HoverCardPrimitive.Trigger;

function HoverCardContent({
  className,
  align = "center",
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Content>) {
  return (
    <HoverCardPrimitive.Portal>
      <HoverCardPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-[100] w-72 rounded-lg border border-border bg-surface p-4 text-foreground shadow-pop outline-none",
          "data-[state=open]:animate-fade-in data-[state=closed]:animate-none",
          className
        )}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  );
}

export { HoverCard, HoverCardTrigger, HoverCardContent };
