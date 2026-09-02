"use client";

/**
 * In-mock Writing task surface (WS-5.2). A word-counted essay editor that submits
 * to the existing async Writing scorer and polls for the returned band + criteria
 * + feedback. The draft (essay + in-flight response id) is persisted through the
 * player's response map via `onChange`, so it survives part/section navigation and
 * a reload resumes the poll. Registered for the `writing_*` question types.
 *
 * Task 1 keeps its figure (Academic) or letter brief (General Training) beside
 * the editor; the exam textarea, minimum-length meter and GT scaffold live in
 * `../writing/`.
 */
import { useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { IeltsRendererProps } from "../question-renderer-registry";
import type { WritingResponseView } from "@/lib/api/ielts/writing-responses-repository";
import { showToast } from "@/components/shared/toast";
import {
  CaptureRequestError,
  pollWritingResponse,
  submitWritingResponse,
} from "@/lib/api/ielts/capture-client";
import {
  countWords,
  parseWritingCaptureValue,
  recommendedMinWords,
} from "@/lib/ielts/capture/capture-format";
import { GtLetterScaffold } from "../writing/GtLetterScaffold";
import { WritingEditor } from "../writing/WritingEditor";
import { WritingScoreCard } from "../writing/WritingScoreCard";
import { CaptureErrorNote, CaptureScoringNote } from "./CaptureBandResult";
import { QuestionVisual } from "./QuestionVisual";
import { useScoringPoll } from "./useScoringPoll";
import {
  canStartPaidScoring,
  getCaptureActionState,
} from "./capture-action-state";

/**
 * Task 1 keeps its brief beside the editor: the Academic figure (charts go
 * through `QuestionVisual` → `@/components/charts`) or the GT letter scaffold.
 */
function WritingTaskLayout({
  question,
  children,
}: {
  question: IeltsRendererProps["question"];
  children: ReactNode;
}) {
  const t = useTranslations("ielts.player");
  const brief = question.visual ? (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="type-caption font-semibold uppercase tracking-wide text-on-surface-variant">
        {t("writing.task1Visual")}
      </span>
      <QuestionVisual visual={question.visual} />
    </div>
  ) : question.letter ? (
    <GtLetterScaffold letter={question.letter} />
  ) : null;

  if (!brief) return <>{children}</>;
  return (
    <div className="grid items-start gap-5 lg:grid-cols-2">
      {brief}
      {children}
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
      words={words}
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
      <WritingTaskLayout question={question}>{editor}</WritingTaskLayout>

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
