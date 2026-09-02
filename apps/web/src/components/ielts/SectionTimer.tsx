"use client";

/**
 * Section countdown (WS-2.1). DISPLAY ONLY — the DB deadline is authoritative;
 * this ticks the client clock against the stored deadline and re-syncs whenever
 * a server action returns fresh timing. While paused it shows the frozen
 * remaining time; on reaching zero it notifies the player to lock the section
 * (the server already rejects any late write).
 *
 * `warningSeconds` (from the assessment-mode policy) fires `onWarning` once per
 * threshold per deadline via the pure `nextTimerWarning` policy.
 */
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  remainingSeconds,
  sectionStatus,
  type SectionRuntimeStatus,
  type SectionTimingState,
} from "@/lib/ielts/section-timing";
import { nextTimerWarning, warningMinutes } from "@/lib/ielts/timer-warnings";

const NO_WARNINGS: readonly number[] = [];

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function SectionTimer({
  timing,
  warningSeconds = NO_WARNINGS,
  onExpire,
  onStatusChange,
  onWarning,
}: {
  timing: SectionTimingState;
  /** Thresholds (seconds remaining) to announce, e.g. `[600, 300]`. */
  warningSeconds?: readonly number[];
  onExpire?: () => void;
  onStatusChange?: (status: SectionRuntimeStatus) => void;
  /** Called once per threshold per deadline, with the threshold in seconds. */
  onWarning?: (threshold: number) => void;
}) {
  const t = useTranslations("ielts.player.exam");
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [warningAnnouncement, setWarningAnnouncement] = useState("");
  const expiredRef = useRef(false);
  const firedRef = useRef<number[]>([]);
  // Latest inputs for the 1 Hz tick, so the interval itself stays stable.
  const tickInputsRef = useRef({ timing, warningSeconds, onWarning, t });

  const status = sectionStatus(timing, nowMs);
  const remaining = remainingSeconds(timing, nowMs);
  const ticking = status === "running";

  useEffect(() => {
    tickInputsRef.current = { timing, warningSeconds, onWarning, t };
  }, [timing, warningSeconds, onWarning, t]);

  // A new deadline (resume, re-sync, next section) starts the warnings over.
  useEffect(() => {
    firedRef.current = [];
  }, [timing.deadlineAt]);

  useEffect(() => {
    if (!ticking) return;
    const tick = () => {
      const now = Date.now();
      setNowMs(now);
      const inputs = tickInputsRef.current;
      const threshold = nextTimerWarning(
        remainingSeconds(inputs.timing, now),
        inputs.warningSeconds,
        firedRef.current,
      );
      if (threshold === null) return;
      firedRef.current = [...firedRef.current, threshold];
      const minutes = warningMinutes(threshold);
      setWarningAnnouncement(
        minutes <= 1
          ? inputs.t("timerWarningOne")
          : inputs.t("timerWarning", { minutes }),
      );
      inputs.onWarning?.(threshold);
    };
    const id = setInterval(tick, 1000);
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

  const announcement =
    status === "expired" ? `${t("time")} ${formatClock(0)}` : warningAnnouncement;

  const low = ticking && remaining <= 60;
  const label =
    status === "paused"
      ? t("timerPaused")
      : status === "submitted"
        ? t("timerSubmitted")
        : status === "not_started"
          ? t("timerNotStarted")
          : formatClock(remaining);

  return (
    <div
      className={`flex items-center gap-2 rounded-full px-4 py-1.5 type-label font-bold tabular-nums ${
        low
          ? "bg-error-container text-error"
          : "bg-surface-container-high text-on-surface"
      }`}
    >
      <span className="type-caption font-semibold uppercase tracking-wide text-on-surface-variant">
        {t("time")}
      </span>
      {label}
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
