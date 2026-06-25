"use client";

/**
 * In-mock Speaking task surface (WS-5.2). Records the spoken answer in the
 * browser, encodes it to WAV PCM 16 kHz mono (so STT + Azure pronunciation both
 * work), uploads it, submits to the existing async Speaking scorer, and polls for
 * the band + criteria + feedback (carrying a real phoneme report when Azure creds
 * are present). The in-flight response id is persisted via `onChange` so a reload
 * resumes the poll. Registered for the `speaking_*` question types.
 */
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { IeltsRendererProps } from "../question-renderer-registry";
import type { SpeakingResponseView } from "@/lib/api/ielts/speaking-responses-repository";
import {
  CaptureRequestError,
  pollSpeakingResponse,
  submitSpeakingResponse,
  uploadSpeakingAudio,
} from "@/lib/api/ielts/capture-client";
import {
  extractFeedbackSummary,
  hasPhonemeDetail,
  parseSpeakingCaptureValue,
} from "@/lib/ielts/capture/capture-format";
import {
  useSpeakingRecorder,
  type RecorderErrorCode,
  type SpeakingRecorder,
} from "./useSpeakingRecorder";
import {
  CaptureBandResult,
  CaptureDetails,
  CaptureErrorNote,
  CaptureScoringNote,
  type CaptureBandRow,
} from "./CaptureBandResult";
import { useScoringPoll } from "./useScoringPoll";

const RECORDER_ERROR_KEYS: Record<RecorderErrorCode, string> = {
  mic_denied: "speaking.micDenied",
  no_audio: "speaking.noSpeech",
  encode_failed: "speaking.failed",
};

const PILL = "rounded-full px-5 py-2 type-body-sm font-semibold disabled:opacity-50";

function speakingGuidanceKey(questionType: string): string {
  if (questionType === "speaking_part1") return "speaking.part1Hint";
  if (questionType === "speaking_part2_cuecard") return "speaking.part2Hint";
  if (questionType === "speaking_part3") return "speaking.part3Hint";
  return "speaking.intro";
}

function SpeakingCapture({
  recorder,
  disabled,
  submitting,
  canSubmit,
  submitted,
  onSubmit,
  onRecordAgain,
}: {
  recorder: SpeakingRecorder;
  disabled: boolean;
  submitting: boolean;
  canSubmit: boolean;
  submitted: boolean;
  onSubmit: () => void;
  onRecordAgain: () => void;
}) {
  const t = useTranslations("ielts.player");

  if (recorder.status === "recording") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-outline-variant bg-surface-container px-4 py-3">
        <span className="flex items-center gap-2 type-body-sm font-medium text-on-surface">
          <span className="size-2.5 animate-pulse rounded-full bg-error" aria-hidden="true" />
          {t("speaking.recording")} · {recorder.elapsedSeconds}s
        </span>
        <button type="button" onClick={recorder.stop} className={`${PILL} bg-primary text-on-primary`}>
          {t("speaking.stop")}
        </button>
      </div>
    );
  }

  if (recorder.status === "processing") {
    return <CaptureScoringNote title={t("speaking.processing")} />;
  }

  if (recorder.result) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl border border-outline-variant bg-surface-container px-4 py-3">
        <span className="type-caption font-semibold uppercase tracking-wide text-on-surface-variant">
          {t("speaking.yourRecording")}
        </span>
        <audio controls src={recorder.result.playbackUrl} className="w-full" />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onRecordAgain}
            disabled={disabled || submitting}
            className={`${PILL} bg-surface-container-high text-on-surface`}
          >
            {t("speaking.rerecord")}
          </button>
          {submitted ? null : (
            <button
              type="button"
              onClick={onSubmit}
              disabled={submitting || !canSubmit}
              className={`${PILL} bg-primary text-on-primary`}
            >
              {submitting ? t("speaking.submitting") : t("speaking.submit")}
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void recorder.start()}
      disabled={disabled}
      className={`${PILL} self-start bg-primary text-on-primary`}
    >
      {t("speaking.record")}
    </button>
  );
}

function SpeakingScoreCard({ view }: { view: SpeakingResponseView }) {
  const t = useTranslations("ielts.player");
  const locale = useLocale();
  const rows: CaptureBandRow[] = [
    { key: "fc", label: t("bands.fluencyCoherence"), band: view.bands.fluencyCoherence },
    { key: "lr", label: t("bands.lexicalResource"), band: view.bands.lexicalResource },
    { key: "gr", label: t("bands.grammaticalRangeAccuracy"), band: view.bands.grammaticalRangeAccuracy },
    { key: "pr", label: t("bands.pronunciation"), band: view.bands.pronunciation },
  ];
  return (
    <CaptureBandResult
      headlineLabel={t("speaking.speakingBand")}
      headlineBand={view.bands.speaking}
      rows={rows}
      summary={extractFeedbackSummary(view.feedback, locale)}
    >
      {view.transcript ? (
        <CaptureDetails summary={t("speaking.transcript")}>
          {view.transcript}
        </CaptureDetails>
      ) : null}
      {hasPhonemeDetail(view.phonemeReport) ? (
        <p className="type-caption text-on-surface-variant">
          {t("speaking.pronunciationDetail")}
        </p>
      ) : null}
    </CaptureBandResult>
  );
}

export function SpeakingTaskRenderer({
  question,
  value,
  disabled,
  onChange,
  context,
}: IeltsRendererProps) {
  const t = useTranslations("ielts.player");
  const locale = useLocale();
  const recorder = useSpeakingRecorder();

  const [initial] = useState(() => parseSpeakingCaptureValue(value));
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const poll = useScoringPoll<SpeakingResponseView>(
    initial.speakingResponseId,
    pollSpeakingResponse,
  );

  const attemptId = context?.attemptId ?? null;
  const working = submitting || poll.pending;
  const recorderErrorKey = recorder.error ? RECORDER_ERROR_KEYS[recorder.error] : null;
  const guidanceKey = speakingGuidanceKey(question.questionType);

  const handleRecordAgain = () => {
    recorder.reset();
    poll.clear();
    setErrorKey(null);
    onChange({ speakingResponseId: null, audioStoragePath: null });
  };

  const handleSubmit = async () => {
    const result = recorder.result;
    if (!attemptId || submitting || !result) return;
    setSubmitting(true);
    setErrorKey(null);
    try {
      const audioStoragePath = await uploadSpeakingAudio({
        attemptId,
        questionId: question.id,
        wav: result.wav,
      });
      const submitted = await submitSpeakingResponse({
        attemptId,
        questionId: question.id,
        audioStoragePath,
        durationSeconds: Math.max(1, Math.round(result.durationSeconds)),
        feedbackLanguage: locale === "vi" ? "vi" : "en",
      });
      poll.begin(submitted.speakingResponseId);
      onChange({ speakingResponseId: submitted.speakingResponseId, audioStoragePath });
    } catch (error) {
      const limit = error instanceof CaptureRequestError && error.status === 402;
      setErrorKey(limit ? "speaking.limitReached" : "speaking.failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="type-body-sm text-on-surface-variant">{t(guidanceKey)}</p>

      <SpeakingCapture
        recorder={recorder}
        disabled={disabled}
        submitting={submitting}
        canSubmit={Boolean(attemptId) && !disabled}
        submitted={Boolean(poll.responseId)}
        onSubmit={handleSubmit}
        onRecordAgain={handleRecordAgain}
      />

      {recorderErrorKey ? <CaptureErrorNote message={t(recorderErrorKey)} /> : null}
      {errorKey ? <CaptureErrorNote message={t(errorKey)} /> : null}
      {working ? (
        <CaptureScoringNote
          title={submitting ? t("speaking.submitting") : t("speaking.scoring")}
          hint={t("speaking.scoringHint")}
        />
      ) : null}
      {poll.scored && poll.view ? <SpeakingScoreCard view={poll.view} /> : null}
    </div>
  );
}
