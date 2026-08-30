"use client";

/**
 * Section countdown (WS-2.1). DISPLAY ONLY — the DB deadline is authoritative;
 * this ticks the client clock against the stored deadline and re-syncs whenever
 * a server action returns fresh timing. While paused it shows the frozen
 * remaining time; on reaching zero it notifies the player to lock the section
 * (the server already rejects any late write).
 */
import { useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
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

type TimerCopy = {
  expired: string;
  minute: string;
  five: string;
  paused: string;
  submitted: string;
  notStarted: string;
  time: string;
};

function timerCopy(locale: string): TimerCopy {
  if (locale === "vi") {
    return {
      expired: "Đã hết thời gian.",
      minute: "Còn khoảng một phút.",
      five: "Còn khoảng năm phút.",
      paused: "Đã tạm dừng",
      submitted: "Đã nộp",
      notStarted: "Chưa bắt đầu",
      time: "Thời gian",
    };
  }
  return {
    expired: "Time expired.",
    minute: "Approximately one minute remaining.",
    five: "Approximately five minutes remaining.",
    paused: "Paused",
    submitted: "Submitted",
    notStarted: "Not started",
    time: "Time",
  };
}

function timerAnnouncement(
  status: SectionRuntimeStatus,
  remaining: number,
  copy: TimerCopy,
): string {
  if (status === "expired") return copy.expired;
  if (status !== "running") return "";
  if (remaining <= 60) return copy.minute;
  if (remaining <= 300) return copy.five;
  return "";
}

function timerLabel(
  status: SectionRuntimeStatus,
  remaining: number,
  copy: TimerCopy,
): string {
  if (status === "paused") return copy.paused;
  if (status === "submitted") return copy.submitted;
  if (status === "not_started") return copy.notStarted;
  return formatClock(remaining);
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
  const locale = useLocale();
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

  const copy = timerCopy(locale);
  const announcement = timerAnnouncement(status, remaining, copy);

  const low = ticking && remaining <= 60;
  const label = timerLabel(status, remaining, copy);

  return (
    <div
      className={`flex items-center gap-2 rounded-full px-4 py-1.5 text-sm font-bold tabular-nums ${
        low
          ? "bg-error-container text-error"
          : "bg-surface-container-high text-on-surface"
      }`}
    >
      <span className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
        {copy.time}
      </span>
      {label}
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
