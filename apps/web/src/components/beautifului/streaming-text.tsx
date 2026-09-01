import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Adapted from Beautiful UI's Streaming Text and follow-up treatment.
 * Original source Copyright (c) 2026 Shane Levine, MIT License.
 */
export function BeautifulStreamingText({
  children,
  streaming = false,
  className,
}: {
  children: ReactNode;
  streaming?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)} aria-busy={streaming}>
      {children}
      {streaming ? (
        <span
          aria-hidden="true"
          className="ml-1 inline-block h-4 w-0.5 translate-y-0.5 rounded-full bg-on-surface motion-safe:animate-pulse"
        />
      ) : null}
    </div>
  );
}

export interface BeautifulFollowUp {
  id: string;
  label: string;
  value: string;
}

export function BeautifulFollowUps({
  label,
  items,
  onSelect,
  disabled = false,
  className,
}: {
  label: string;
  items: BeautifulFollowUp[];
  onSelect: (item: BeautifulFollowUp) => void;
  disabled?: boolean;
  className?: string;
}) {
  if (items.length === 0) return null;

  return (
    <div className={cn("mt-4", className)}>
      <div className="mb-2 type-caption font-medium text-on-surface-variant">
        {label}
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item)}
            disabled={disabled}
            className="min-h-8 rounded-control border border-outline-variant bg-surface px-3 py-1.5 text-left type-label font-medium text-on-surface transition-[border-color,background-color,transform] duration-150 hover:border-primary/30 hover:bg-primary/5 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
