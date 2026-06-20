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
import { useScoringPoll } from "./useScoringPoll";

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
  const rows: CaptureBandRow[] = [
    { key: "tr", label: t("bands.taskResponse"), band: view.bands.taskResponse },
    { key: "cc", label: t("bands.coherenceCohesion"), band: view.bands.coherenceCohesion },
    { key: "lr", label: t("bands.lexicalResource"), band: view.bands.lexicalResource },
    { key: "gr", label: t("bands.grammaticalRangeAccuracy"), band: view.bands.grammaticalRangeAccuracy },
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
    </CaptureBandResult>
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
  const words = countWords(essay);
  const working = submitting || poll.pending;
  const canSubmit = Boolean(attemptId) && !disabled && !submitting && words > 0;

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
    } catch (error) {
      const limit = error instanceof CaptureRequestError && error.status === 402;
      setErrorKey(limit ? "writing.limitReached" : "writing.failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <p className="type-body-sm text-on-surface-variant">{t("writing.intro")}</p>
      <textarea
        value={essay}
        disabled={disabled || submitting}
        onChange={(event) => handleEssay(event.target.value)}
        placeholder={t("writing.placeholder")}
        className="min-h-[40vh] w-full resize-y rounded-2xl border border-outline-variant bg-surface px-4 py-3 type-body-sm leading-relaxed text-on-surface placeholder:text-on-surface-variant disabled:opacity-60"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <WordCount words={words} minWords={recommendedMinWords(question.questionType)} />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="rounded-full bg-primary px-5 py-2 type-body-sm font-semibold text-on-primary disabled:opacity-50"
        >
          {poll.responseId ? t("writing.resubmit") : t("writing.submit")}
        </button>
      </div>

      {errorKey ? <CaptureErrorNote message={t(errorKey)} /> : null}
      {working ? (
        <CaptureScoringNote
          title={submitting ? t("writing.submitting") : t("writing.scoring")}
          hint={t("writing.scoringHint")}
        />
      ) : null}
      {poll.scored && poll.view ? <WritingScoreCard view={poll.view} /> : null}
    </div>
  );
}
