"use client";

import type { ReactNode } from "react";
import { Check, ChevronDown, CircleAlert, Clock } from "@/components/ui/icons";
import { cn } from "@/lib/utils";

const STATUS_ICON = {
  idle: Clock,
  running: Clock,
  complete: Check,
  error: CircleAlert,
};

/**
 * Adapted from Beautiful UI's compact Tool Chips.
 * Original source Copyright (c) 2026 Shane Levine, MIT License.
 */
export function BeautifulToolChip({
  label,
  detail,
  status = "idle",
  icon,
  expanded,
  onExpandedChange,
  className,
}: {
  label: string;
  detail?: ReactNode;
  status?: "idle" | "running" | "complete" | "error";
  icon?: ReactNode;
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  className?: string;
}) {
  const StatusIcon = STATUS_ICON[status];
  const canExpand = detail !== undefined && onExpandedChange !== undefined;

  return (
    <div className={cn("w-fit max-w-full", className)}>
      <button
        type="button"
        aria-expanded={canExpand ? Boolean(expanded) : undefined}
        onClick={() => canExpand && onExpandedChange(!expanded)}
        disabled={!canExpand}
        className={cn(
          "inline-flex min-h-7 max-w-full items-center gap-1.5 rounded-lg border border-outline-variant bg-surface-container-low px-2 type-caption font-medium text-on-surface-variant transition-colors duration-150",
          canExpand &&
            "hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          status === "error" && "border-error/25 bg-error/5 text-error",
        )}
      >
        {icon ?? (
          <StatusIcon className="size-3.5 shrink-0" aria-hidden="true" />
        )}
        <span className="truncate">{label}</span>
        {canExpand ? (
          <ChevronDown
            className={cn(
              "size-3.5 shrink-0 transition-transform duration-150",
              expanded && "rotate-180",
            )}
            aria-hidden="true"
          />
        ) : null}
      </button>
      {canExpand && expanded ? (
        <div className="mt-1.5 rounded-control border border-outline-variant bg-surface px-3 py-2 type-caption text-on-surface-variant">
          {detail}
        </div>
      ) : null}
    </div>
  );
}
