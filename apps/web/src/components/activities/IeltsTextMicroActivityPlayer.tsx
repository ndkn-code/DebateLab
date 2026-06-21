"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2 } from "@/components/ui/icons";
import { loadIeltsTextActivityView } from "@/app/actions/ielts-learn-activities";
import type { ActivityPlayerProps } from "@/lib/activity/registry";
import {
  IeltsTextActivityContentSchema,
  isIeltsTextChoiceActivity,
  type IeltsTextActivityContent,
  IeltsTextActivityQuestionView,
  IeltsTextActivityView,
} from "@/lib/ielts/learn/text-activities";

function isChoiceActivity(content: IeltsTextActivityContent): boolean {
  return isIeltsTextChoiceActivity(content.activityType);
}

function sourceLabel(
  content: IeltsTextActivityContent,
  questionId: string,
  language: "en" | "vi",
): string | null {
  const source = content.sources.find((item) => item.questionId === questionId);
  if (!source) return null;
  return language === "vi" ? source.labelVi ?? null : source.labelEn ?? null;
}

function QuestionPrompt({
  content,
  question,
}: {
  content: IeltsTextActivityContent;
  question: IeltsTextActivityQuestionView;
}) {
  const labelEn = sourceLabel(content, question.questionId, "en");
  const labelVi = sourceLabel(content, question.questionId, "vi");
  return (
    <div className="space-y-2">
      {labelEn || labelVi ? (
        <div className="flex flex-wrap gap-2">
          {labelEn ? (
            <span className="rounded-md bg-surface-container px-2 py-1 type-caption font-semibold text-on-surface-variant">
              {labelEn}
            </span>
          ) : null}
          {labelVi ? (
            <span className="rounded-md bg-surface-container px-2 py-1 type-caption font-semibold text-on-surface-variant">
              {labelVi}
            </span>
          ) : null}
        </div>
      ) : null}
      {question.groupInstructions ? (
        <p className="type-body-sm text-on-surface-variant">
          {question.groupInstructions}
        </p>
      ) : null}
      <p className="type-body font-semibold text-on-surface">{question.prompt}</p>
      {question.wordLimit ? (
        <p className="type-caption text-on-surface-variant">
          NO MORE THAN {question.wordLimit} WORDS
        </p>
      ) : null}
    </div>
  );
}

function ChoiceQuestion({
  question,
  value,
  onChange,
}: {
  question: IeltsTextActivityQuestionView;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2">
      {question.options.map((option) => (
        <label
          key={option.value}
          className="flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-outline-variant bg-surface px-3 py-2 transition-colors hover:border-primary/40"
        >
          <input
            type="radio"
            name={question.questionId}
            value={option.value}
            checked={value === option.value}
            onChange={() => onChange(option.value)}
            className="size-4 accent-primary"
          />
          <span className="type-body-sm text-on-surface">{option.label}</span>
        </label>
      ))}
    </div>
  );
}

function GapQuestion({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="min-h-12 w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 type-body text-on-surface outline-none transition-colors placeholder:text-on-surface-variant focus:border-primary"
      placeholder="Type your answer"
    />
  );
}

function RationaleQuestion({
  prompt,
  value,
  onChange,
}: {
  prompt: { en: string; vi: string };
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="grid gap-2">
      <span className="type-label text-on-surface">{prompt.en}</span>
      <span className="type-caption text-on-surface-variant">{prompt.vi}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-h-24 w-full resize-y rounded-lg border border-outline-variant bg-surface px-3 py-2 type-body-sm text-on-surface outline-none transition-colors placeholder:text-on-surface-variant focus:border-primary"
        placeholder="Short reason"
      />
    </label>
  );
}

function hasAnswer(
  question: IeltsTextActivityQuestionView,
  answers: Record<string, string>,
): boolean {
  return (answers[question.questionId] ?? "").trim().length > 0;
}

export function IeltsTextMicroActivityPlayer({
  content,
  onComplete,
}: ActivityPlayerProps<unknown>) {
  const parsed = useMemo(
    () => IeltsTextActivityContentSchema.safeParse(content),
    [content],
  );
  const [view, setView] = useState<IeltsTextActivityView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [rationales, setRationales] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;
    if (!parsed.success) {
      return;
    }

    loadIeltsTextActivityView(parsed.data)
      .then((nextView) => {
        if (!active) return;
        setView(nextView);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : "Unable to load activity.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [parsed]);

  if (!parsed.success) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        <div className="rounded-lg border border-error bg-error-container px-4 py-3 type-body-sm text-on-error-container">
          This IELTS activity content is not valid.
        </div>
      </div>
    );
  }

  const activityContent = parsed.data;
  const questions = view?.questions ?? [];
  const readyToSubmit =
    questions.length > 0 && questions.every((question) => hasAnswer(question, answers));

  const handleSubmit = () => {
    void onComplete(0, questions.length, {
      activityType: activityContent.activityType,
      answers: questions.map((question) => ({
        questionId: question.questionId,
        value: answers[question.questionId] ?? "",
        rationale:
          activityContent.activityType === "ielts_tfng_reasoning"
            ? rationales[question.questionId] ?? ""
            : undefined,
      })),
    });
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 pb-10">
      <section className="space-y-2">
        <p className="type-label font-semibold text-primary">
          {activityContent.instruction.en}
        </p>
        <p className="type-body-sm text-on-surface-variant">
          {activityContent.instruction.vi}
        </p>
      </section>

      {loading ? (
        <div className="flex min-h-40 items-center justify-center rounded-lg border border-outline-variant bg-surface">
          <Loader2 className="size-5 animate-spin text-primary" />
        </div>
      ) : loadError ? (
        <div className="rounded-lg border border-error bg-error-container px-4 py-3 type-body-sm text-on-error-container">
          {loadError}
        </div>
      ) : (
        <div className="grid gap-3">
          {questions.map((question, index) => (
            <article
              key={question.questionId}
              className="space-y-4 rounded-lg border border-outline-variant bg-surface p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <QuestionPrompt content={activityContent} question={question} />
                <span className="rounded-md bg-surface-container px-2 py-1 type-caption font-semibold text-on-surface-variant">
                  {index + 1}/{questions.length}
                </span>
              </div>
              {isChoiceActivity(activityContent) && question.options.length > 0 ? (
                <ChoiceQuestion
                  question={question}
                  value={answers[question.questionId] ?? ""}
                  onChange={(value) =>
                    setAnswers((current) => ({
                      ...current,
                      [question.questionId]: value,
                    }))
                  }
                />
              ) : (
                <GapQuestion
                  value={answers[question.questionId] ?? ""}
                  onChange={(value) =>
                    setAnswers((current) => ({
                      ...current,
                      [question.questionId]: value,
                    }))
                  }
                />
              )}
              {activityContent.activityType === "ielts_tfng_reasoning" &&
              view?.rationalePrompt ? (
                <RationaleQuestion
                  prompt={view.rationalePrompt}
                  value={rationales[question.questionId] ?? ""}
                  onChange={(value) =>
                    setRationales((current) => ({
                      ...current,
                      [question.questionId]: value,
                    }))
                  }
                />
              ) : null}
            </article>
          ))}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!readyToSubmit}
          onClick={handleSubmit}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-primary px-4 py-2 type-label font-semibold text-on-primary transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CheckCircle2 className="size-4" />
          Submit
        </button>
      </div>
    </div>
  );
}
