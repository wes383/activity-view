import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-full font-medium leading-none select-none transition-all duration-150 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-accent text-accent-fg hover:bg-accent-hover",
        outline: "border border-border bg-surface text-foreground hover:bg-hover",
        ghost: "bg-transparent text-foreground hover:bg-hover",
        subtle: "bg-hover text-foreground hover:bg-hover-strong",
        danger: "bg-red-solid text-white hover:bg-red-solid-hover",
      },
      size: {
        xs: "h-8 px-3 text-xs gap-1.5",
        sm: "h-9 px-4 text-sm",
        md: "h-10 px-5 text-sm",
        icon: "h-10 w-10 p-0",
        "icon-sm": "h-9 w-9 p-0",
        "icon-xs": "h-8 w-8 p-0",
      },
    },
    defaultVariants: { variant: "outline", size: "sm" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, type = "button", ...props }, ref) => (
    <button ref={ref} type={type} className={cn(buttonVariants({ variant, size, className }))} {...props} />
  )
);
Button.displayName = "Button";

export { buttonVariants };
