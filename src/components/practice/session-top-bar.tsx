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
    <header className="border-b border-zinc-800/50 bg-zinc-950/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-4xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          <h1 className="truncate text-sm font-medium text-zinc-200">
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
          <span className="rounded-md bg-zinc-800 px-2.5 py-1 text-xs text-zinc-400">
            {mode === "full" ? "Full Round" : "Quick"}
          </span>
          {phase === "speaking" && (
            <span className="rounded-md bg-blue-500/10 px-2.5 py-1 text-xs font-medium text-blue-400">
              Opening Statement
            </span>
          )}
        </div>
      </div>
    </header>
  );
}
