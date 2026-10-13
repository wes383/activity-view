"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const Drawer = DialogPrimitive.Root;
const DrawerTrigger = DialogPrimitive.Trigger;
const DrawerClose = DialogPrimitive.Close;

function DrawerContent({
  className,
  children,
  closeLabel,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { closeLabel: string }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-[110] animate-fade-in bg-overlay backdrop-blur-sm" />
      <DialogPrimitive.Content
        className={cn(
          "fixed inset-y-2 left-2 z-[110] flex max-h-[calc(100dvh_-_1rem)] w-[calc(100%_-_1rem)] max-w-[280px] flex-col",
          "overflow-y-auto rounded-xl border border-border bg-surface shadow-dialog animate-fade-slide-in focus:outline-none",
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close
          aria-label={closeLabel}
          className="absolute right-3 top-3 inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-hover hover:text-foreground"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export { Drawer, DrawerTrigger, DrawerClose, DrawerContent };
