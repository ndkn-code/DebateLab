"use client";

/**
 * Upload + submit + poll lifecycle for one Speaking answer. Owns the scoring
 * poll, the submit flag, and the error key; the renderer owns the recorder and
 * the cue-card timer.
 */
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { SpeakingResponseView } from "@/lib/api/ielts/speaking-responses-repository";
import { showToast } from "@/components/shared/toast";
import {
  CaptureRequestError,
  pollSpeakingResponse,
  submitSpeakingResponse,
  uploadSpeakingAudio,
} from "@/lib/api/ielts/capture-client";
import {
  canStartPaidScoring,
  getCaptureActionState,
  type CaptureActionState,
} from "../capture-action-state";
import { useScoringPoll } from "../useScoringPoll";
import type { RecorderResult } from "../useSpeakingRecorder";

export interface SpeakingSubmission {
  submitting: boolean;
  /** i18n key under `ielts.player` for a submit/limit error, if any. */
  errorKey: string | null;
  actionState: CaptureActionState;
  /** Draft or retryable — a new recording/submission may start. */
  canAct: boolean;
  /** `canAct` plus a live attempt and an enabled surface. */
  canSubmit: boolean;
  /** Upload in flight or scorer still working. */
  working: boolean;
  pollFailed: boolean;
  scoredView: SpeakingResponseView | null;
  submit: (result: RecorderResult) => Promise<void>;
  /** Forget the in-flight/scored response so the learner can re-record. */
  clear: () => void;
}

export function useSpeakingSubmission({
  attemptId,
  questionId,
  initialResponseId,
  disabled,
  onChange,
}: {
  attemptId: string | null;
  questionId: string;
  initialResponseId: string | null;
  disabled: boolean;
  onChange: (value: unknown) => void;
}): SpeakingSubmission {
  const t = useTranslations("ielts.player");
  const locale = useLocale();
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const poll = useScoringPoll<SpeakingResponseView>(
    initialResponseId,
    pollSpeakingResponse,
  );

  const actionState = getCaptureActionState({
    responseId: poll.responseId,
    scored: poll.scored,
    failed: poll.failed,
    submitting,
  });
  const canAct = canStartPaidScoring(actionState);

  const submit = async (result: RecorderResult) => {
    if (!attemptId || submitting || !canAct) return;
    setSubmitting(true);
    setErrorKey(null);
    try {
      const audioStoragePath = await uploadSpeakingAudio({
        attemptId,
        questionId,
        wav: result.wav,
      });
      const submitted = await submitSpeakingResponse({
        attemptId,
        questionId,
        audioStoragePath,
        durationSeconds: Math.max(1, Math.round(result.durationSeconds)),
        feedbackLanguage: locale === "vi" ? "vi" : "en",
      });
      poll.begin(submitted.speakingResponseId);
      onChange({
        speakingResponseId: submitted.speakingResponseId,
        audioStoragePath,
      });
      showToast(t("speaking.toastSubmitted"), "success");
    } catch (error) {
      const limit =
        error instanceof CaptureRequestError && error.status === 402;
      const key = limit ? "speaking.limitReached" : "speaking.failed";
      setErrorKey(key);
      showToast(t(key), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const clear = () => {
    poll.clear();
    setErrorKey(null);
    onChange({ speakingResponseId: null, audioStoragePath: null });
  };

  return {
    submitting,
    errorKey,
    actionState,
    canAct,
    canSubmit: canAct && Boolean(attemptId) && !disabled,
    working: submitting || poll.pending,
    pollFailed: poll.failed,
    scoredView: poll.scored ? poll.view : null,
    submit,
    clear,
  };
}
