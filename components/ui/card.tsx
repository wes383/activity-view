import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border bg-surface text-foreground",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
  children,
  ...props
}: Omit<React.HTMLAttributes<HTMLDivElement>, "title"> & {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn("flex flex-col gap-1.5 p-5", className)}
      {...props}
    >
      {(title || action) && (
        <div className="flex items-start justify-between gap-3">
          {title ? (
            <h3 className="font-display text-lg font-semibold leading-tight tracking-tight">
              {title}
            </h3>
          ) : null}
          {action ? <div className="ml-auto shrink-0 self-start">{action}</div> : null}
        </div>
      )}
      {description ? (
        <p className="text-sm text-foreground-muted">{description}</p>
      ) : null}
      {children}
    </div>
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 pt-0", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center p-5 pt-0", className)} {...props} />;
}
