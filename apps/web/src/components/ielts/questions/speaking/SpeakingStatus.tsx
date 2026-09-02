"use client";

/** Error / scoring / result stack under the Speaking capture controls. */
import { useTranslations } from "next-intl";
import type { SpeakingResponseView } from "@/lib/api/ielts/speaking-responses-repository";
import { CaptureErrorNote, CaptureScoringNote } from "../CaptureBandResult";
import type { RecorderErrorCode } from "../useSpeakingRecorder";
import { SpeakingScoreCard } from "./SpeakingScoreCard";

const RECORDER_ERROR_KEYS: Record<RecorderErrorCode, string> = {
  mic_denied: "speaking.micDenied",
  no_audio: "speaking.noSpeech",
  encode_failed: "speaking.failed",
};

export function SpeakingStatus({
  timeUp,
  recorderError,
  errorKey,
  pollFailed,
  working,
  submitting,
  scoredView,
}: {
  /** Part 2: the speaking clock stopped the recording. */
  timeUp: boolean;
  recorderError: RecorderErrorCode | null;
  errorKey: string | null;
  pollFailed: boolean;
  working: boolean;
  submitting: boolean;
  scoredView: SpeakingResponseView | null;
}) {
  const t = useTranslations("ielts.player");
  const recorderErrorKey = recorderError
    ? RECORDER_ERROR_KEYS[recorderError]
    : null;
  return (
    <>
      {timeUp ? (
        <p className="type-caption font-medium text-on-surface-variant">
          {t("speaking.cueCard.timeUp")}
        </p>
      ) : null}
      {recorderErrorKey ? (
        <CaptureErrorNote message={t(recorderErrorKey)} />
      ) : null}
      {errorKey ? <CaptureErrorNote message={t(errorKey)} /> : null}
      {pollFailed && !errorKey ? (
        <CaptureErrorNote message={t("speaking.failed")} />
      ) : null}
      {working ? (
        <CaptureScoringNote
          title={submitting ? t("speaking.submitting") : t("speaking.scoring")}
          hint={t("speaking.scoringHint")}
        />
      ) : null}
      {scoredView ? <SpeakingScoreCard view={scoredView} /> : null}
    </>
  );
}
