"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ArrowRight, CheckCircle2, XCircle } from "@/components/ui/icons";
import { Button } from "@/components/ui/button";
import { Eyebrow, Heading } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { markLessonCompleteAction } from "@/app/actions/enrollment";
import type { LessonWithContext } from "@/lib/api/courses";

interface QuizRendererProps {
  lesson: LessonWithContext;
  courseSlug: string;
}

export function QuizRenderer({ lesson, courseSlug }: QuizRendererProps) {
  const t = useTranslations("dashboard.courses");
  const router = useRouter();
  const questions = lesson.quiz_questions;
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());
  const [showResult, setShowResult] = useState(false);
  const [grading, setGrading] = useState<
    Map<string, { is_correct: boolean; points: number; max_points: number }>
  >(new Map());
  const [submittedScore, setSubmittedScore] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(
    lesson.progress?.status === "completed",
  );
  const [isPending, startTransition] = useTransition();
  const current = questions[currentIdx];
  const selectedAnswer = answers.get(current?.id ?? "");
  const isLast = currentIdx === questions.length - 1;
  const score = submittedScore ?? 0;

  const handleSelect = (answer: string) => {
    if (!current || showResult) return;
    setAnswers((previous) => {
      const next = new Map(previous);
      next.set(current.id, answer);
      return next;
    });
  };

  const handleCheck = () => {
    setShowResult(true);
  };

  const handleNext = () => {
    if (!current) return;

    if (!showResult) {
      setShowResult(true);
      return;
    }

    if (isLast) {
      startTransition(async () => {
        const result = await markLessonCompleteAction(
          lesson.id,
          lesson.course.id,
          Object.fromEntries(answers.entries()),
          undefined,
          courseSlug,
        );
        setSubmittedScore(result.score);
        setGrading(
          new Map(
            (result.grading ?? []).map((item) => [item.question_id, item]),
          ),
        );
        setSubmitted(true);
        router.refresh();
      });
      return;
    }

    setShowResult(false);
    setCurrentIdx((previous) => previous + 1);
  };

  if (questions.length === 0) {
    return (
      <div className="rounded-xl border border-outline-variant bg-surface p-5 text-center">
        <p className="text-on-surface-variant">{t("reader.quiz_empty")}</p>
      </div>
    );
  }

  if (submitted) {
    const hasSessionAnswers = answers.size > 0;
    const correctCount = [...grading.values()].filter(
      (result) => result.is_correct,
    ).length;

    return (
      <div className="rounded-xl border border-outline-variant bg-surface p-5 text-center">
        <div
          className={cn(
            "mx-auto flex h-24 w-24 items-center justify-center rounded-full text-2xl font-semibold",
            !hasSessionAnswers || score >= 75
              ? "bg-emerald-500/10 text-emerald-600"
              : score >= 40
                ? "bg-amber-500/10 text-amber-600"
                : "bg-rose-500/10 text-rose-500",
          )}
        >
          {hasSessionAnswers ? (
            `${score}%`
          ) : (
            <CheckCircle2 className="h-8 w-8" />
          )}
        </div>
        <Heading level={2} as="h3" className="mt-5 font-semibold">
          {!hasSessionAnswers
            ? t("reader.quiz_completed")
            : score >= 75
              ? t("reader.quiz_result_great")
              : score >= 40
                ? t("reader.quiz_result_good")
                : t("reader.quiz_result_retry")}
        </Heading>
        <p className="mt-2 text-sm text-on-surface-variant">
          {hasSessionAnswers
            ? t("reader.quiz_result_summary", {
                correct: correctCount,
                total: questions.length,
              })
            : t("lesson.complete", {
                progress: lesson.courseProgressPercent,
              })}
        </p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-600">
          <CheckCircle2 className="h-4 w-4" />
          {t("reader.quiz_completed")}
        </div>
      </div>
    );
  }

  const currentGrade = grading.get(current.id);
  const hasGrade = Boolean(currentGrade);
  const isCorrect = currentGrade?.is_correct ?? false;

  return (
    <div className="rounded-xl border border-outline-variant bg-surface p-4 sm:p-5">
      <div className="flex flex-col gap-4 border-b border-outline-variant/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Eyebrow className="font-semibold text-primary">
            {t("reader.quiz_kicker")}
          </Eyebrow>
          <p className="mt-2 text-sm text-on-surface-variant">
            {t("reader.quiz_question_progress", {
              current: currentIdx + 1,
              total: questions.length,
            })}
          </p>
        </div>
        <div className="flex gap-1.5">
          {questions.map((_, index) => (
            <div
              key={index}
              className={cn(
                "h-2.5 w-8 rounded-full transition-colors",
                index < currentIdx
                  ? "bg-primary"
                  : index === currentIdx
                    ? "bg-primary/45"
                    : "bg-surface-container",
              )}
            />
          ))}
        </div>
      </div>

      <div className="mt-6">
        <Heading level={3} as="h3" className="leading-8">
          {current.question_text}
        </Heading>

        <div className="mt-6 space-y-3">
          {(current.options ?? []).map((option, index) => {
            const letter = String.fromCharCode(65 + index);
            const isSelected = selectedAnswer === option;
            const isCorrectOption =
              hasGrade && currentGrade?.is_correct === true && isSelected;

            return (
              <button
                key={option}
                type="button"
                onClick={() => handleSelect(option)}
                disabled={showResult}
                className={cn(
                  "flex w-full items-center gap-4 rounded-[1.35rem] border px-4 py-4 text-left transition-colors",
                  isCorrectOption
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : hasGrade && showResult && isSelected && !isCorrect
                      ? "border-rose-500/40 bg-rose-500/10"
                      : isSelected
                        ? "border-primary/35 bg-primary/5"
                        : "border-outline-variant/20 bg-surface-container-lowest hover:border-primary/20 hover:bg-surface-container",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                    isCorrectOption
                      ? "bg-emerald-500 text-white"
                      : hasGrade && showResult && isSelected && !isCorrect
                        ? "bg-rose-500 text-white"
                        : isSelected
                          ? "bg-primary text-white"
                          : "bg-surface-container text-on-surface-variant",
                  )}
                >
                  {hasGrade && isCorrectOption ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : hasGrade && showResult && isSelected && !isCorrect ? (
                    <XCircle className="h-4 w-4" />
                  ) : (
                    letter
                  )}
                </span>
                <span className="text-sm leading-6 text-on-surface">
                  {option}
                </span>
              </button>
            );
          })}
        </div>

        {showResult && current.explanation ? (
          <div className="mt-5 rounded-[1.5rem] border border-outline-variant/15 bg-surface-container-low p-4">
            <p className="text-sm leading-7 text-on-surface-variant">
              <span className="font-semibold text-on-surface">
                {t("reader.quiz_explanation_label")}
              </span>{" "}
              {current.explanation}
            </p>
          </div>
        ) : null}
      </div>

      <div className="mt-8 flex justify-end">
        {!showResult ? (
          <Button
            onClick={handleCheck}
            disabled={!selectedAnswer}
            className="bg-primary text-on-primary"
            size="lg"
          >
            {t("reader.quiz_check_answer")}
          </Button>
        ) : (
          <Button
            onClick={handleNext}
            disabled={isPending}
            className="gap-2 bg-primary text-on-primary"
            size="lg"
          >
            {isLast ? t("reader.quiz_finish") : t("reader.quiz_next_question")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
