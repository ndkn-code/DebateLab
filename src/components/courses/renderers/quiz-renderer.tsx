"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
  const [submitted, setSubmitted] = useState(
    lesson.progress?.status === "completed"
  );
  const [isPending, startTransition] = useTransition();
  const current = questions[currentIdx];
  const selectedAnswer = answers.get(current?.id ?? "");
  const isLast = currentIdx === questions.length - 1;
  const score = useMemo(() => {
    if (questions.length === 0) return 0;
    const correct = questions.filter(
      (question) => answers.get(question.id) === question.correct_answer
    ).length;
    return Math.round((correct / questions.length) * 100);
  }, [answers, questions]);

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
      setSubmitted(true);
      startTransition(async () => {
        await markLessonCompleteAction(
          lesson.id,
          lesson.course.id,
          score,
          undefined,
          courseSlug
        );
        router.refresh();
      });
      return;
    }

    setShowResult(false);
    setCurrentIdx((previous) => previous + 1);
  };

  if (questions.length === 0) {
    return (
      <div className="rounded-[2rem] border border-outline-variant/15 bg-white p-8 text-center shadow-[0_26px_80px_-56px_rgba(22,39,91,0.42)]">
        <p className="text-on-surface-variant">{t("reader.quiz_empty")}</p>
      </div>
    );
  }

  if (submitted) {
    const hasSessionAnswers = answers.size > 0;
    const correctCount = questions.filter(
      (question) => answers.get(question.id) === question.correct_answer
    ).length;

    return (
      <div className="rounded-[2rem] border border-outline-variant/15 bg-white p-8 text-center shadow-[0_26px_80px_-56px_rgba(22,39,91,0.42)]">
        <div
          className={cn(
            "mx-auto flex h-24 w-24 items-center justify-center rounded-full text-2xl font-semibold",
            !hasSessionAnswers || score >= 75
              ? "bg-emerald-500/10 text-emerald-600"
              : score >= 40
                ? "bg-amber-500/10 text-amber-600"
                : "bg-rose-500/10 text-rose-500"
          )}
        >
          {hasSessionAnswers ? `${score}%` : <CheckCircle2 className="h-8 w-8" />}
        </div>
        <h3 className="mt-5 text-2xl font-semibold text-on-surface">
          {!hasSessionAnswers
            ? t("reader.quiz_completed")
            : score >= 75
              ? t("reader.quiz_result_great")
              : score >= 40
                ? t("reader.quiz_result_good")
                : t("reader.quiz_result_retry")}
        </h3>
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

  const isCorrect = selectedAnswer === current.correct_answer;

  return (
    <div className="rounded-[2rem] border border-outline-variant/15 bg-white p-6 shadow-[0_26px_80px_-56px_rgba(22,39,91,0.42)] sm:p-8">
      <div className="flex flex-col gap-4 border-b border-outline-variant/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {t("reader.quiz_kicker")}
          </p>
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
                    : "bg-surface-container"
              )}
            />
          ))}
        </div>
      </div>

      <div className="mt-6">
        <h3 className="text-xl font-semibold leading-8 text-on-surface">
          {current.question_text}
        </h3>

        <div className="mt-6 space-y-3">
          {(current.options ?? []).map((option, index) => {
            const letter = String.fromCharCode(65 + index);
            const isSelected = selectedAnswer === option;
            const isCorrectOption = option === current.correct_answer;

            return (
              <button
                key={option}
                type="button"
                onClick={() => handleSelect(option)}
                disabled={showResult}
                className={cn(
                  "flex w-full items-center gap-4 rounded-[1.35rem] border px-4 py-4 text-left transition-colors",
                  showResult && isCorrectOption
                    ? "border-emerald-500/40 bg-emerald-500/10"
                    : showResult && isSelected && !isCorrect
                      ? "border-rose-500/40 bg-rose-500/10"
                      : isSelected
                        ? "border-primary/35 bg-primary/5"
                        : "border-outline-variant/20 bg-surface-container-lowest hover:border-primary/20 hover:bg-surface-container"
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold",
                    showResult && isCorrectOption
                      ? "bg-emerald-500 text-white"
                      : showResult && isSelected && !isCorrect
                        ? "bg-rose-500 text-white"
                        : isSelected
                          ? "bg-primary text-white"
                          : "bg-surface-container text-on-surface-variant"
                  )}
                >
                  {showResult && isCorrectOption ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : showResult && isSelected && !isCorrect ? (
                    <XCircle className="h-4 w-4" />
                  ) : (
                    letter
                  )}
                </span>
                <span className="text-sm leading-6 text-on-surface">{option}</span>
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
