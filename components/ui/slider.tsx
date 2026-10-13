"use client";

import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

const TRACK_SIZES = {
  compact: "h-1",
  default: "h-1.5",
  comfortable: "h-2",
} as const;

const THUMB_SIZES = {
  compact: "h-3.5 w-3.5",
  default: "h-4 w-4",
  comfortable: "h-5 w-5",
} as const;

export function Slider({
  className,
  trackClassName,
  rangeClassName,
  thumbClassName,
  size = "default",
  ariaLabel,
  value,
  defaultValue,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root> & {
  /** Track / thumb thickness tier. */
  size?: keyof typeof TRACK_SIZES;
  trackClassName?: string;
  rangeClassName?: string;
  thumbClassName?: string;
  /** Radix puts role="slider" on the thumb, so the name belongs there. */
  ariaLabel?: string;
}) {
  const values = value ?? defaultValue;
  const thumbCount = Array.isArray(values) ? values.length : 1;

  return (
    <SliderPrimitive.Root
      className={cn("relative flex w-full touch-none select-none items-center", className)}
      value={value}
      defaultValue={defaultValue}
      {...props}
    >
      <SliderPrimitive.Track
        className={cn("relative w-full grow overflow-hidden rounded-full bg-hover-strong", TRACK_SIZES[size], trackClassName)}
      >
        <SliderPrimitive.Range className={cn("absolute h-full rounded-full bg-accent", rangeClassName)} />
      </SliderPrimitive.Track>
      {Array.from({ length: thumbCount }).map((_, index) => (
        <SliderPrimitive.Thumb
          key={index}
          aria-label={ariaLabel}
          className={cn(
            "block cursor-pointer rounded-full border-2 border-accent bg-surface shadow-sm transition-transform",
            "hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
            THUMB_SIZES[size],
            thumbClassName
          )}
        />
      ))}
    </SliderPrimitive.Root>
  );
}
