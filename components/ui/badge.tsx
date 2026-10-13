import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-md font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-fg",
        secondary: "bg-muted text-foreground-muted",
        outline: "border border-border text-foreground",
        success: "border border-green-border bg-green-soft text-green-fg",
        warning: "border border-orange-border bg-orange-soft text-orange-fg",
        danger: "border border-red-border bg-red-soft text-red-fg",
        info: "border border-blue-border bg-blue-soft text-blue-fg",
      },
      size: {
        xs: "px-1.5 py-px text-[11px] gap-1",
        sm: "px-2 py-0.5 text-xs",
        md: "px-3 py-1 text-sm",
      },
    },
    defaultVariants: { variant: "secondary", size: "sm" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  dot?: string;
}

export function Badge({ className, variant, size, dot, children, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, size, className }))} {...props}>
      {dot ? <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} /> : null}
      {children}
    </span>
  );
}

export { badgeVariants };
