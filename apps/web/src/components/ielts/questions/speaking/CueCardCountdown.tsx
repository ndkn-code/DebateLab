"use client";

/**
 * The Part 2 timed stage: a large countdown for preparation, then for
 * speaking. Prep may be skipped in practice; simulation runs the full minute.
 */
import { useTranslations } from "next-intl";
import { Timer } from "@/components/ui/icons";
import { ExamButton } from "../../exam/ExamButton";
import { formatCountdown } from "./speaking-guidance";

export function CueCardCountdown({
  phase,
  remaining,
  canSkipPrep,
  onSkipPrep,
}: {
  phase: "prep" | "speaking";
  remaining: number;
  canSkipPrep: boolean;
  onSkipPrep: () => void;
}) {
  const t = useTranslations("ielts.player.speaking.cueCard");
  const prep = phase === "prep";

  return (
    <div
      role="timer"
      aria-live="polite"
      aria-label={t("remaining", { seconds: remaining })}
      className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-outline-variant bg-surface-container px-4 py-3"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="inline-flex items-center gap-1.5 type-caption font-semibold uppercase tracking-wide text-on-surface-variant">
          <Timer className="size-3.5" aria-hidden="true" />
          {prep ? t("prep") : t("speakNow")}
        </span>
        <span className="type-body-sm text-on-surface-variant">
          {prep ? t("prepBody") : t("speakingBody")}
        </span>
      </div>
      <div className="flex items-center gap-4">
        <span
          className={`type-display-sm tabular-nums ${prep ? "text-on-surface" : "text-primary"}`}
        >
          {formatCountdown(remaining)}
        </span>
        {prep && canSkipPrep ? (
          <ExamButton tone="quiet" onClick={onSkipPrep}>
            {t("skipPrep")}
          </ExamButton>
        ) : null}
      </div>
    </div>
  );
}
