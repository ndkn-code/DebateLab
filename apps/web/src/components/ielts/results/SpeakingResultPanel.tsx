"use client";

/**
 * Speaking result panel (WS-2.2 / WS-3.2): per-part band, prompt, the
 * learner's recording (signed URL, replayable) above the transcript, grader
 * transparency, criteria, and the pronunciation heatmap.
 */
import { useLocale, useTranslations } from "next-intl";
import { AudioClipPlayer } from "@/components/ielts/exam/AudioClipPlayer";
import {
  GradingResultDetails,
  gradingPresentationFromResult,
  type GradingProcessStatus,
} from "@/components/ielts/learner/GradingResultDetails";
import type {
  SpeakingPartResult,
  SpeakingResult,
} from "@/lib/ielts/results/types";
import { bandText } from "./format";
import { PronunciationHeatmap } from "./PronunciationDetails";
import {
  CriteriaList,
  ModelAnswer,
  PendingNote,
  Prompt,
  TeacherPublishedNote,
  isScored,
} from "./SkillFeedbackPanels";
import {
  interpolateResultCopy as interpolate,
  useSkillFeedbackCopy as useResultCopy,
} from "./skill-feedback-copy";

function SpeakingPartCard({ part }: { part: SpeakingPartResult }) {
  const locale = useLocale();
  const copy = useResultCopy();
  const t = useTranslations("ielts.results.review");
  const label = part.partNumber
    ? interpolate(copy.part, part.partNumber)
    : copy.speakingResponse;
  const hasTranscript = part.transcript.trim().length > 0;
  const grading = gradingPresentationFromResult(part);
  return (
    <div className="rounded-xl border border-outline-variant bg-surface-container p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="type-title text-on-surface">{label}</h3>
        <span className="type-body-sm text-on-surface-variant">
          {copy.band}{" "}
          <span className="font-bold text-on-surface tabular-nums">
            {bandText(part.band)}
          </span>
        </span>
      </div>
      {part.prompt || hasTranscript || part.audioUrl ? (
        <div className="mt-3 flex flex-col gap-3">
          <Prompt text={part.prompt} />
          {part.audioUrl ? (
            <AudioClipPlayer src={part.audioUrl} title={t("yourRecording")} />
          ) : null}
          {hasTranscript ? (
            <div className="rounded-xl border border-outline-variant bg-surface px-3 py-2">
              <p className="type-caption font-semibold uppercase text-on-surface-variant">
                {copy.transcript}
              </p>
              <p className="mt-1 whitespace-pre-wrap type-body-sm text-on-surface">
                {part.transcript}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
      {grading ? (
        <div className="mt-3">
          <GradingResultDetails
            criteria={part.criteria}
            metadata={grading.metadata}
            retrySafeRunId={grading.retrySafeRunId}
            status={part.status as GradingProcessStatus}
            locale={locale}
          />
        </div>
      ) : null}
      {isScored(part.status) ? (
        <div className="mt-3 flex flex-col gap-3">
          <TeacherPublishedNote note={part.teacherFeedback} locale={locale} />
          {grading ? null : <CriteriaList criteria={part.criteria} />}
          {part.summary ? (
            <p className="type-body-sm text-on-surface">{part.summary}</p>
          ) : null}
          <PronunciationHeatmap heatmap={part.pronunciationHeatmap} />
        </div>
      ) : (
        <div className="mt-3">
          <PendingNote skill={label} failed={part.status === "failed"} />
        </div>
      )}
      {part.modelAnswer ? (
        <div className="mt-3">
          <ModelAnswer text={part.modelAnswer} />
        </div>
      ) : null}
    </div>
  );
}

export function SpeakingResultPanel({
  speaking,
}: {
  speaking: SpeakingResult;
}) {
  const copy = useResultCopy();
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="type-heading-md text-on-surface">{copy.speaking}</h2>
        <span className="type-body-sm text-on-surface-variant">
          {copy.band}{" "}
          <span className="font-bold text-on-surface tabular-nums">
            {bandText(speaking.band)}
          </span>
        </span>
      </div>
      {speaking.parts.map((part) => (
        <SpeakingPartCard key={part.questionId} part={part} />
      ))}
    </section>
  );
}
