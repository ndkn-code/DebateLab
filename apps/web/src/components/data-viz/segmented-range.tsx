"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

export type RangeOption<T extends string = string> = { value: T; label: string };

type SegmentedRangeProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options?: RangeOption<T>[];
  className?: string;
};

const DEFAULT_OPTIONS: RangeOption[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
];

/** Compact preset range switcher (7D / 30D / 90D by default). */
export function SegmentedRange<T extends string>({
  value,
  onChange,
  options,
  className,
}: SegmentedRangeProps<T>) {
  const resolved = (options ?? (DEFAULT_OPTIONS as RangeOption<T>[]));
  return (
    <div
      role="tablist"
      aria-label="Time range"
      className={cn("inline-flex items-center gap-1 rounded-lg bg-surface-container p-1", className)}
    >
      {resolved.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "type-label rounded-md px-2.5 py-1 transition-colors",
              active
                ? "bg-[var(--card-bg)] text-on-surface shadow-token-card"
                : "text-on-surface-variant hover:text-on-surface",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
