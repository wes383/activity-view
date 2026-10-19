"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardHeader } from "@/components/ui/card";
import { DataState, Skeleton } from "@/components/ui/display";

/** Card + header + uniform data state, used by every analytics panel. */
export function Panel({
  title,
  description,
  action,
  isLoading,
  error,
  isEmpty,
  emptyTitle,
  emptyDescription,
  skeletonHeight = 240,
  bodyClassName,
  className,
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  isLoading: boolean;
  error?: unknown;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  skeletonHeight?: number;
  bodyClassName?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card className={cn("flex flex-col overflow-hidden", className)}>
      {title ? <CardHeader title={title} description={description} action={action} /> : null}
      <div className={cn("flex-1 p-5", !title && "pt-5", bodyClassName)}>
        <DataState
          isLoading={isLoading}
          error={error}
          isEmpty={isEmpty}
          emptyTitle={emptyTitle}
          emptyDescription={emptyDescription}
          skeleton={<Skeleton style={{ height: skeletonHeight }} className="w-full" />}
        >
          {children}
        </DataState>
      </div>
    </Card>
  );
}
