"use client";

/**
 * Section countdown (WS-2.1). DISPLAY ONLY — the DB deadline is authoritative;
 * this ticks the client clock against the stored deadline and re-syncs whenever
 * a server action returns fresh timing. While paused it shows the frozen
 * remaining time; on reaching zero it notifies the player to lock the section
 * (the server already rejects any late write).
 */
import { useEffect, useRef, useState } from "react";
import {
  remainingSeconds,
  sectionStatus,
  type SectionRuntimeStatus,
  type SectionTimingState,
} from "@/lib/ielts/section-timing";

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function SectionTimer({
  timing,
  onExpire,
  onStatusChange,
}: {
  timing: SectionTimingState;
  onExpire?: () => void;
  onStatusChange?: (status: SectionRuntimeStatus) => void;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const expiredRef = useRef(false);

  const status = sectionStatus(timing, nowMs);
  const remaining = remainingSeconds(timing, nowMs);
  const ticking = status === "running";

  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [ticking]);

  useEffect(() => {
    onStatusChange?.(status);
    if (status === "expired" && !expiredRef.current) {
      expiredRef.current = true;
      onExpire?.();
    }
    if (status === "running") expiredRef.current = false;
  }, [status, onExpire, onStatusChange]);

  const low = ticking && remaining <= 60;
  const label =
    status === "paused"
      ? "Paused"
      : status === "submitted"
        ? "Submitted"
        : status === "not_started"
          ? "Not started"
          : formatClock(remaining);

  return (
    <div
      className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold tabular-nums ${
        low
          ? "bg-error-container text-error"
          : "bg-surface-container-high text-on-surface"
      }`}
      aria-live="polite"
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
        Time
      </span>
      {label}
    </div>
  );
}
