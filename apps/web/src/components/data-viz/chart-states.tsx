"use client";

import * as React from "react";

import { cn } from "@/lib/utils";
import { Heading, Text } from "@/components/ui/typography";
import { Shimmer } from "@/components/motion/shimmer";

/** Loading placeholder shaped like a bar chart. */
export function ChartSkeleton({ className, bars = 7 }: { className?: string; bars?: number }) {
  return (
    <div className={cn("flex h-40 items-end gap-2", className)} aria-hidden>
      {Array.from({ length: bars }).map((_, index) => {
        const heightPct = 35 + ((index * 41) % 60);
        return (
          <div key={index} className="flex-1" style={{ height: `${heightPct}%` }}>
            <Shimmer className="h-full w-full" rounded="rounded-md" />
          </div>
        );
      })}
    </div>
  );
}

/** Quiet empty state for a chart with no data yet. */
export function ChartEmpty({
  title = "No data yet",
  description,
  icon,
  action,
  className,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex h-40 flex-col items-center justify-center gap-2 text-center", className)}>
      {icon && <span className="text-on-surface-variant">{icon}</span>}
      <Heading level={4} className="text-on-surface">
        {title}
      </Heading>
      {description && (
        <Text variant="body-sm" className="text-on-surface-variant">
          {description}
        </Text>
      )}
      {action}
    </div>
  );
}

/** Retryable error state. */
export function ChartError({
  title = "Couldn’t load this",
  description = "Try again in a moment.",
  onRetry,
  retryLabel = "Retry",
  className,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex h-40 flex-col items-center justify-center gap-2 text-center", className)}>
      <Heading level={4} className="text-error">
        {title}
      </Heading>
      <Text variant="body-sm" className="text-on-surface-variant">
        {description}
      </Text>
      {onRetry && (
        <button type="button" onClick={onRetry} className="type-label text-primary hover:underline">
          {retryLabel}
        </button>
      )}
    </div>
  );
}
