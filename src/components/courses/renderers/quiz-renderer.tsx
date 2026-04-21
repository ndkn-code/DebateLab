"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, XCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { markLessonCompleteAction } from "@/app/actions/enrollment";
import type { LessonWithContext } from "@/lib/api/courses";

interface QuizRendererProps {
  lesson: LessonWithContext;
  courseSlug: string;
}

export function QuizRenderer({ lesson, courseSlug }: QuizRendererProps) {
  const questions = lesson.quiz_questions;
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Map<string, string>>(new Map());
  const [showResult, setShowResult] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [completed, setCompleted] = useState(
    lesson.progress?.status === "completed"
  );

  const current = questions[currentIdx];
  const selectedAnswer = answers.get(current?.id ?? "");
  const isLast = currentIdx === questions.length - 1;

  const handleSelect = (answer: string) => {
    if (showResult) return;
    setAnswers(new Map(answers.set(current.id, answer)));
  };

  const handleCheck = () => {
    setShowResult(true);
  };

  const handleNext = () => {
    setShowResult(false);
    if (isLast) {
      // Calculate score and submit
      let correct = 0;
      for (const q of questions) {
        if (answers.get(q.id) === q.correct_answer) correct++;
      }
      const score = Math.round((correct / questions.length) * 100);
      setSubmitted(true);

      startTransition(async () => {
        await markLessonCompleteAction(
          lesson.id,
          lesson.course.id,
          score,
          undefined,
          courseSlug
        );
        setCompleted(true);
      });
    } else {
      setCurrentIdx(currentIdx + 1);
    }
  };

  if (questions.length === 0) {
    return (
      <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-8 text-center soft-shadow">
        <p className="text-on-surface-variant">No quiz questions available.</p>
      </div>
    );
  }

  // Show final score
  if (submitted) {
    let correct = 0;
    for (const q of questions) {
      if (answers.get(q.id) === q.correct_answer) correct++;
    }
    const score = Math.round((correct / questions.length) * 100);

    return (
      <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-8 text-center soft-shadow">
        <div
          className={cn(
            "mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full text-2xl font-bold",
            score >= 75
              ? "bg-emerald-500/10 text-emerald-600"
              : score >= 40
                ? "bg-amber-500/10 text-amber-600"
                : "bg-red-500/10 text-red-500"
          )}
        >
          {score}%
        </div>
        <h3 className="mb-1 text-lg font-semibold text-on-surface">
          {score >= 75
            ? "Great job!"
            : score >= 40
              ? "Good effort!"
              : "Keep practicing!"}
        </h3>
        <p className="text-sm text-on-surface-variant">
          You got {correct} out of {questions.length} correct
        </p>
        {completed && (
          <div className="mt-4 flex items-center justify-center gap-2 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">Quiz completed</span>
          </div>
        )}
      </div>
    );
  }

  const isCorrect = selectedAnswer === current.correct_answer;

  return (
    <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 sm:p-8 soft-shadow">
      {/* Progress */}
      <div className="mb-6 flex items-center justify-between">
        <span className="text-sm font-medium text-on-surface-variant">
          Question {currentIdx + 1} of {questions.length}
        </span>
        <div className="flex gap-1">
          {questions.map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-1.5 w-6 rounded-full",
                i < currentIdx
                  ? "bg-primary"
                  : i === currentIdx
                    ? "bg-primary/50"
                    : "bg-surface-container"
              )}
            />
          ))}
        </div>
      </div>

      {/* Question */}
      <h3 className="mb-6 text-lg font-semibold text-on-surface">
        {current.question_text}
      </h3>

      {/* Options */}
      <div className="space-y-3">
        {(current.options ?? []).map((option, i) => {
          const letter = String.fromCharCode(65 + i);
          const isSelected = selectedAnswer === option;
          const isCorrectOption = option === current.correct_answer;

          return (
            <button
              key={i}
              onClick={() => handleSelect(option)}
              disabled={showResult}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm transition-all",
                showResult && isCorrectOption
                  ? "border-emerald-500/50 bg-emerald-500/10"
                  : showResult && isSelected && !isCorrect
                    ? "border-red-500/50 bg-red-500/10"
                    : isSelected
                      ? "border-primary/50 bg-primary/5"
                      : "border-outline-variant/20 hover:border-primary/30 hover:bg-surface-container"
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-medium",
                  showResult && isCorrectOption
                    ? "bg-emerald-500 text-white"
                    : showResult && isSelected && !isCorrect
                      ? "bg-red-500 text-white"
                      : isSelected
                        ? "bg-primary text-on-primary"
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
              <span className="text-on-surface">{option}</span>
            </button>
          );
        })}
      </div>

      {/* Explanation */}
      {showResult && current.explanation && (
        <div className="mt-4 rounded-xl bg-surface-container p-4">
          <p className="text-sm text-on-surface-variant">
            <strong className="text-on-surface">Explanation:</strong>{" "}
            {current.explanation}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="mt-6 flex justify-end gap-3">
        {!showResult ? (
          <Button
            onClick={handleCheck}
            disabled={!selectedAnswer}
            className="bg-primary text-on-primary"
          >
            Check Answer
          </Button>
        ) : (
          <Button
            onClick={handleNext}
            disabled={isPending}
            className="gap-2 bg-primary text-on-primary"
          >
            {isLast ? "Finish Quiz" : "Next Question"}
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
