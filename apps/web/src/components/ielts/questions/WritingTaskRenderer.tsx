"use client";

/**
 * In-mock Writing task surface (WS-5.2). A word-counted essay editor that submits
 * to the existing async Writing scorer and polls for the returned band + criteria
 * + feedback. The draft (essay + in-flight response id) is persisted through the
 * player's response map via `onChange`, so it survives part/section navigation and
 * a reload resumes the poll. Registered for the `writing_*` question types.
 */
import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { IeltsRendererProps } from "../question-renderer-registry";
import type { WritingResponseView } from "@/lib/api/ielts/writing-responses-repository";
import { showToast } from "@/components/shared/toast";
import { GradingConfidenceNote } from "@/components/ielts/learner/GradingConfidenceNote";
import { gradingPresentationFromResult } from "@/components/ielts/learner/GradingResultDetails";
import {
  CaptureRequestError,
  pollWritingResponse,
  submitWritingResponse,
} from "@/lib/api/ielts/capture-client";
import {
  countWords,
  extractFeedbackSummary,
  parseWritingCaptureValue,
  recommendedMinWords,
} from "@/lib/ielts/capture/capture-format";
import {
  CaptureBandResult,
  CaptureDetails,
  CaptureErrorNote,
  CaptureScoringNote,
  type CaptureBandRow,
} from "./CaptureBandResult";
import { QuestionVisual } from "./QuestionVisual";
import { useScoringPoll } from "./useScoringPoll";
import {
  canStartPaidScoring,
  getCaptureActionState,
} from "./capture-action-state";

function WordCount({ words, minWords }: { words: number; minWords: number }) {
  const t = useTranslations("ielts.player");
  const below = words > 0 && words < minWords;
  return (
    <span className="type-caption text-on-surface-variant">
      {t("writing.wordCount", { count: words })}
      {below ? ` · ${t("writing.recommendedMin", { count: minWords })}` : ""}
    </span>
  );
}

function WritingScoreCard({ view }: { view: WritingResponseView }) {
  const t = useTranslations("ielts.player");
  const locale = useLocale();
  const grading = gradingPresentationFromResult(view);
  const rows: CaptureBandRow[] = [
    {
      key: "tr",
      label: t("bands.taskResponse"),
      band: view.bands.taskResponse,
    },
    {
      key: "cc",
      label: t("bands.coherenceCohesion"),
      band: view.bands.coherenceCohesion,
    },
    {
      key: "lr",
      label: t("bands.lexicalResource"),
      band: view.bands.lexicalResource,
    },
    {
      key: "gr",
      label: t("bands.grammaticalRangeAccuracy"),
      band: view.bands.grammaticalRangeAccuracy,
    },
  ];
  return (
    <CaptureBandResult
      headlineLabel={t("writing.taskBand")}
      headlineBand={view.bands.task}
      rows={rows}
      summary={extractFeedbackSummary(view.criteriaFeedback, locale)}
    >
      {view.modelAnswer ? (
        <CaptureDetails summary={t("writing.modelAnswer")}>
          {view.modelAnswer}
        </CaptureDetails>
      ) : null}
      {grading ? (
        <GradingConfidenceNote metadata={grading.metadata} locale={locale} />
      ) : null}
    </CaptureBandResult>
  );
}

function WritingEditor({
  essay,
  minWords,
  disabled,
  isSimulation,
  actionState,
  canSubmit,
  onEssay,
  onSubmit,
}: {
  essay: string;
  minWords: number;
  disabled: boolean;
  isSimulation: boolean;
  actionState: ReturnType<typeof getCaptureActionState>;
  canSubmit: boolean;
  onEssay: (text: string) => void;
  onSubmit: () => void;
}) {
  const t = useTranslations("ielts.player");
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <textarea
        value={essay}
        disabled={disabled}
        onChange={(event) => onEssay(event.target.value)}
        placeholder={t("writing.placeholder")}
        className="min-h-[40vh] w-full resize-y rounded-xl border border-outline-variant bg-surface px-4 py-3 type-body-sm leading-relaxed text-on-surface outline-none placeholder:text-on-surface-variant focus-visible:ring-2 focus-visible:ring-primary/45 disabled:opacity-60"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <WordCount words={countWords(essay)} minWords={minWords} />
        {isSimulation ? (
          <span className="type-caption font-medium text-on-surface-variant">
            {t("writing.simulationAutosave")}
          </span>
        ) : canStartPaidScoring(actionState) ? (
          <button
            type="button"
            onClick={onSubmit}
            disabled={!canSubmit}
            className="rounded-full bg-primary px-5 py-2 type-body-sm font-semibold text-on-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 disabled:opacity-50"
          >
            {actionState === "retryable"
              ? t("writing.retry")
              : t("writing.submit")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function WritingStatus({
  isSimulation,
  errorKey,
  failed,
  working,
  submitting,
  scoredView,
}: {
  isSimulation: boolean;
  errorKey: string | null;
  failed: boolean;
  working: boolean;
  submitting: boolean;
  scoredView: WritingResponseView | null;
}) {
  const t = useTranslations("ielts.player");
  if (isSimulation) return null;
  return (
    <>
      {errorKey ? <CaptureErrorNote message={t(errorKey)} /> : null}
      {failed && !errorKey ? (
        <CaptureErrorNote message={t("writing.failed")} />
      ) : null}
      {working ? (
        <CaptureScoringNote
          title={submitting ? t("writing.submitting") : t("writing.scoring")}
          hint={t("writing.scoringHint")}
        />
      ) : null}
      {scoredView ? <WritingScoreCard view={scoredView} /> : null}
    </>
  );
}

export function WritingTaskRenderer({
  question,
  value,
  disabled,
  onChange,
  context,
}: IeltsRendererProps) {
  const t = useTranslations("ielts.player");
  const locale = useLocale();

  const [initial] = useState(() => parseWritingCaptureValue(value));
  const [essay, setEssay] = useState(initial.essay);
  const [submitting, setSubmitting] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const poll = useScoringPoll<WritingResponseView>(
    initial.writingResponseId,
    pollWritingResponse,
  );

  const attemptId = context?.attemptId ?? null;
  const isSimulation = context?.assessmentMode === "simulation";
  const words = countWords(essay);
  const working = submitting || poll.pending;
  const actionState = getCaptureActionState({
    responseId: poll.responseId,
    scored: poll.scored,
    failed: poll.failed,
    submitting,
  });
  const canSubmit =
    !isSimulation &&
    Boolean(attemptId) &&
    !disabled &&
    canStartPaidScoring(actionState) &&
    words > 0;

  const handleEssay = (text: string) => {
    setEssay(text);
    onChange({ essay: text, writingResponseId: poll.responseId });
  };

  const handleSubmit = async () => {
    if (!attemptId || !canSubmit) return;
    setSubmitting(true);
    setErrorKey(null);
    try {
      const result = await submitWritingResponse({
        attemptId,
        questionId: question.id,
        essay,
        feedbackLanguage: locale === "vi" ? "vi" : "en",
      });
      poll.begin(result.writingResponseId);
      onChange({ essay, writingResponseId: result.writingResponseId });
      showToast(t("writing.toastSubmitted"), "success");
    } catch (error) {
      const limit =
        error instanceof CaptureRequestError && error.status === 402;
      const key = limit ? "writing.limitReached" : "writing.failed";
      setErrorKey(key);
      showToast(t(key), "error");
    } finally {
      setSubmitting(false);
    }
  };

  const editor = (
    <WritingEditor
      essay={essay}
      minWords={recommendedMinWords(question.questionType)}
      disabled={disabled || submitting || actionState === "complete"}
      isSimulation={isSimulation}
      actionState={actionState}
      canSubmit={canSubmit}
      onEssay={handleEssay}
      onSubmit={handleSubmit}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      <p className="type-body-sm text-on-surface-variant">
        {t(isSimulation ? "writing.simulationIntro" : "writing.intro")}
      </p>
      {question.visual ? (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <QuestionVisual visual={question.visual} />
          {editor}
        </div>
      ) : (
        editor
      )}

      <WritingStatus
        isSimulation={isSimulation}
        errorKey={errorKey}
        failed={poll.failed}
        working={working}
        submitting={submitting}
        scoredView={poll.scored ? poll.view : null}
      />
    </div>
  );
}
