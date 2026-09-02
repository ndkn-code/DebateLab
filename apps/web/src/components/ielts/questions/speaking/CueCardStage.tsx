"use client";

/**
 * Part 2 timed stage above the capture controls: the "Start preparation" CTA
 * while idle, the prep / speaking countdown while running, nothing once done.
 */
import { useTranslations } from "next-intl";
import type { CueCardTimerState } from "@/lib/ielts/speaking/cue-card-timer";
import { ExamButton } from "../../exam/ExamButton";
import { CueCardCountdown } from "./CueCardCountdown";

export function CueCardStage({
  state,
  remaining,
  disabled,
  canSkipPrep,
  onStartPrep,
  onSkipPrep,
}: {
  state: CueCardTimerState;
  remaining: number;
  disabled: boolean;
  canSkipPrep: boolean;
  onStartPrep: () => void;
  onSkipPrep: () => void;
}) {
  const t = useTranslations("ielts.player.speaking.cueCard");

  if (state.phase === "idle") {
    return (
      <ExamButton
        tone="primary"
        className="self-start"
        onClick={onStartPrep}
        disabled={disabled}
      >
        {t("startPrep")}
      </ExamButton>
    );
  }
  if (state.phase === "done") return null;
  return (
    <CueCardCountdown
      phase={state.phase}
      remaining={remaining}
      canSkipPrep={canSkipPrep}
      onSkipPrep={onSkipPrep}
    />
  );
}
