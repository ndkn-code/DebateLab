"use client";

/**
 * Record / stop / re-record controls, the live recording indicator, and
 * playback of the captured answer. State comes from `useSpeakingRecorder`;
 * Part 2 hides the manual record button because the cue-card timer drives
 * start and stop.
 */
import { useTranslations } from "next-intl";
import { Mic, RotateCcw, Square } from "@/components/ui/icons";
import { AudioClipPlayer } from "../../exam/AudioClipPlayer";
import { ExamButton } from "../../exam/ExamButton";
import { CaptureScoringNote } from "../CaptureBandResult";
import {
  canStartPaidScoring,
  type CaptureActionState,
} from "../capture-action-state";
import type { SpeakingRecorder } from "../useSpeakingRecorder";
import { formatCountdown } from "./speaking-guidance";

export function SpeakingCapture({
  recorder,
  disabled,
  submitting,
  canSubmit,
  actionState,
  remainingSeconds = null,
  hideRecordButton = false,
  onStart,
  onStop,
  onSubmit,
  onRecordAgain,
}: {
  recorder: SpeakingRecorder;
  disabled: boolean;
  submitting: boolean;
  canSubmit: boolean;
  actionState: CaptureActionState;
  /** Countdown shown while recording (Part 2); `null` shows elapsed only. */
  remainingSeconds?: number | null;
  /** Part 2 before the card finishes: the timer, not a button, starts recording. */
  hideRecordButton?: boolean;
  onStart: () => void;
  onStop: () => void;
  onSubmit: () => void;
  onRecordAgain: () => void;
}) {
  const t = useTranslations("ielts.player");

  if (recorder.status === "recording") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline-variant bg-surface-container px-4 py-3">
        <span className="flex items-center gap-2 type-body-sm font-medium text-on-surface">
          <span
            className="size-2.5 animate-pulse rounded-full bg-error"
            aria-hidden="true"
          />
          {t("speaking.recording")}
          <span className="tabular-nums text-on-surface-variant">
            {remainingSeconds === null
              ? formatCountdown(recorder.elapsedSeconds)
              : t("speaking.cueCard.remaining", { seconds: remainingSeconds })}
          </span>
        </span>
        <ExamButton tone="primary" onClick={onStop}>
          <Square className="size-3.5" aria-hidden="true" />
          {t("speaking.stop")}
        </ExamButton>
      </div>
    );
  }

  if (recorder.status === "processing") {
    return <CaptureScoringNote title={t("speaking.processing")} />;
  }

  if (recorder.result) {
    const actionsAvailable = canStartPaidScoring(actionState);
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container px-4 py-3">
        <span className="type-caption font-semibold uppercase tracking-wide text-on-surface-variant">
          {t("speaking.yourRecording")}
        </span>
        <AudioClipPlayer
          src={recorder.result.playbackUrl}
          title={t("speaking.yourRecording")}
        />
        {actionsAvailable ? (
          <div className="flex flex-wrap justify-end gap-2">
            <ExamButton
              tone="quiet"
              onClick={onRecordAgain}
              disabled={disabled || submitting}
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              {t("speaking.rerecord")}
            </ExamButton>
            <ExamButton
              tone="primary"
              onClick={onSubmit}
              disabled={submitting || !canSubmit}
            >
              {submitting
                ? t("speaking.submitting")
                : actionState === "retryable"
                  ? t("speaking.retry")
                  : t("speaking.submit")}
            </ExamButton>
          </div>
        ) : null}
      </div>
    );
  }

  if (hideRecordButton || !canStartPaidScoring(actionState)) return null;

  return (
    <ExamButton
      tone="primary"
      className="self-start"
      onClick={onStart}
      disabled={disabled}
    >
      <Mic className="size-4" aria-hidden="true" />
      {t(actionState === "retryable" ? "speaking.rerecord" : "speaking.record")}
    </ExamButton>
  );
}
