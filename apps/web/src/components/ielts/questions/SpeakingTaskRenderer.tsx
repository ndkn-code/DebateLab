"use client";

/**
 * In-mock Speaking task surface (WS-5.2). Records the spoken answer in the
 * browser, encodes it to WAV PCM 16 kHz mono (so STT + Azure pronunciation both
 * work), uploads it, submits to the existing async Speaking scorer, and polls for
 * the band + criteria + feedback (carrying a real phoneme report when Azure creds
 * are present). The in-flight response id is persisted via `onChange` so a reload
 * resumes the poll. Registered for the `speaking_*` question types.
 *
 * Part 2 adds the cue card + timed stage: preparation countdown → recording
 * auto-starts → speaking countdown → recording auto-stops → submit as usual.
 * Part 1 / Part 3 keep the manual record → stop → submit flow. Upload/poll
 * state lives in `speaking/useSpeakingSubmission`; the clock ↔ recorder binding
 * in `speaking/useCueCardFlow`.
 */
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { IeltsRendererProps } from "../question-renderer-registry";
import { parseSpeakingCaptureValue } from "@/lib/ielts/capture/capture-format";
import { useSpeakingRecorder } from "./useSpeakingRecorder";
import { CueCardStage } from "./speaking/CueCardStage";
import { SpeakingCapture } from "./speaking/SpeakingCapture";
import { SpeakingCueCard } from "./speaking/SpeakingCueCard";
import { SpeakingStatus } from "./speaking/SpeakingStatus";
import {
  cueCardTiming,
  speakingCaptureContext,
  speakingGuidanceKey,
} from "./speaking/speaking-guidance";
import { useCueCardFlow } from "./speaking/useCueCardFlow";
import { useSpeakingSubmission } from "./speaking/useSpeakingSubmission";

export function SpeakingTaskRenderer({
  question,
  value,
  disabled,
  onChange,
  context,
}: IeltsRendererProps) {
  const t = useTranslations("ielts.player");
  const recorder = useSpeakingRecorder();
  const [initial] = useState(() => parseSpeakingCaptureValue(value));
  const { attemptId, isSimulation } = speakingCaptureContext(context);
  const timing = cueCardTiming(question);

  const submission = useSpeakingSubmission({
    attemptId,
    questionId: question.id,
    initialResponseId: initial.speakingResponseId,
    disabled,
    onChange,
  });

  const flow = useCueCardFlow({
    enabled: timing.isCueCard,
    attemptId,
    questionId: question.id,
    prepSeconds: timing.prepSeconds,
    speakSeconds: timing.speakSeconds,
    recorder,
  });

  const stageOpen =
    timing.isCueCard &&
    submission.canAct &&
    !recorder.result &&
    recorder.status !== "processing";

  const handleRecordAgain = () => {
    if (!submission.canAct) return;
    recorder.reset();
    submission.clear();
    flow.reset();
  };

  const handleStart = () => {
    if (submission.actionState === "retryable") handleRecordAgain();
    void recorder.start();
  };

  const handleSubmit = () => {
    if (recorder.result) void submission.submit(recorder.result);
  };

  return (
    <div className="flex flex-col gap-3">
      {timing.isCueCard ? (
        <SpeakingCueCard cueCard={timing.cueCard} prompt={question.prompt} />
      ) : null}
      <p className="type-body-sm text-on-surface-variant">
        {t(speakingGuidanceKey(question.questionType))}
      </p>

      {stageOpen ? (
        <CueCardStage
          state={flow.state}
          remaining={flow.remaining}
          disabled={disabled}
          canSkipPrep={!isSimulation}
          onStartPrep={flow.startPrep}
          onSkipPrep={flow.skipPrep}
        />
      ) : null}

      <SpeakingCapture
        recorder={recorder}
        disabled={disabled}
        submitting={submission.submitting}
        canSubmit={submission.canSubmit}
        actionState={submission.actionState}
        remainingSeconds={flow.phase === "speaking" ? flow.remaining : null}
        hideRecordButton={timing.isCueCard && flow.phase !== "done"}
        onStart={handleStart}
        onStop={flow.stop}
        onSubmit={handleSubmit}
        onRecordAgain={handleRecordAgain}
      />

      <SpeakingStatus
        timeUp={flow.endedByTimer && recorder.result !== null}
        recorderError={recorder.error}
        errorKey={submission.errorKey}
        pollFailed={submission.pollFailed}
        working={submission.working}
        submitting={submission.submitting}
        scoredView={submission.scoredView}
      />
    </div>
  );
}
