"use client";

import { cn } from "@/lib/utils";
import type { Phase } from "@/store/session-store";

interface SessionTopBarProps {
  topicTitle: string;
  side: "proposition" | "opposition";
  mode: string;
  phase: Phase;
}

export function SessionTopBar({
  topicTitle,
  side,
  mode,
  phase,
}: SessionTopBarProps) {
  return (
    <header className="border-b border-outline-variant/10 glass-nav backdrop-blur-xl">
      <div className="mx-auto flex max-w-4xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="truncate text-sm font-medium text-on-surface">
            {topicTitle}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-semibold",
              side === "proposition"
                ? "bg-emerald-500/10 text-emerald-400"
                : "bg-rose-500/10 text-rose-400"
            )}
          >
            {side === "proposition" ? "FOR" : "AGAINST"}
          </span>
          <span className="rounded-md bg-surface-container-high px-2.5 py-1 text-xs text-on-surface-variant">
            {mode === "full" ? "Full Round" : "Quick"}
          </span>
          {(phase === "speaking" || phase === "ai-rebuttal") && (
            <span className="rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
              {phase === "speaking" ? "Speaking" : "AI Turn"}
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
