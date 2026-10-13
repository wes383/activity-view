"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** Popconfirm — a popover whose only job is to confirm one action. */
const Popconfirm = PopoverPrimitive.Root;
const PopconfirmTrigger = PopoverPrimitive.Trigger;

function PopconfirmContent({
  className,
  children,
  destructive = false,
  confirmText,
  cancelText,
  onConfirm,
  onCancel,
  align = "center",
  sideOffset = 8,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content> & {
  /** Confirms with the destructive (red) style. */
  destructive?: boolean;
  confirmText?: React.ReactNode;
  cancelText?: React.ReactNode;
  onConfirm?: () => void;
  onCancel?: () => void;
}) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-[100] w-72 rounded-lg border border-border bg-surface p-4 text-foreground shadow-pop outline-none animate-fade-slide-in",
          className
        )}
        onEscapeKeyDown={() => onCancel?.()}
        onInteractOutside={() => onCancel?.()}
        {...props}
      >
        {children}
        <div className="mt-4 flex justify-end gap-2">
          <Button size="xs" variant="outline" onClick={() => onCancel?.()}>
            {cancelText}
          </Button>
          <Button size="xs" variant={destructive ? "danger" : "default"} onClick={() => onConfirm?.()}>
            {confirmText}
          </Button>
        </div>
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
}

function PopconfirmTitle({ className, ...props }: React.ComponentProps<"h5">) {
  return <h5 className={cn("font-display text-sm font-semibold tracking-tight", className)} {...props} />;
}

function PopconfirmDescription({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("mt-1 text-xs text-foreground-muted", className)} {...props} />;
}

export { Popconfirm, PopconfirmTrigger, PopconfirmContent, PopconfirmTitle, PopconfirmDescription };
