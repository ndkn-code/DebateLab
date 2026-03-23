"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { QuizContent, ActivityContent } from "@/lib/types/admin";

interface Props {
  content: ActivityContent;
  onComplete: (score: number, maxScore: number, responses: Record<string, unknown>) => void;
}

export function QuizPlayer({ content, onComplete }: Props) {
  const t = useTranslations("courses.player");
  const c = content as QuizContent;
  const questions = c.questions ?? [];
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [showResult, setShowResult] = useState(false);
  const [checked, setChecked] = useState(false);

  const q = questions[current];
  const isCorrect = q && answers[q.id] === q.correctAnswer;

  const handleAnswer = (answer: string) => {
    if (checked) return;
    setAnswers((prev) => ({ ...prev, [q.id]: answer }));
  };

  const handleCheck = () => setChecked(true);

  const handleNext = () => {
    setChecked(false);
    if (current < questions.length - 1) {
      setCurrent(current + 1);
    } else {
      // Show results
      setShowResult(true);
      const score = questions.filter((q) => answers[q.id] === q.correctAnswer).length;
      onComplete(score, questions.length, answers);
    }
  };

  if (questions.length === 0) return <p className="text-sm text-on-surface-variant">No questions</p>;

  if (showResult) {
    const score = questions.filter((q) => answers[q.id] === q.correctAnswer).length;
    return (
      <div className="text-center space-y-4 py-6">
        <p className="text-2xl font-bold text-on-surface">{t("results", { score, total: questions.length })}</p>
        <div className="space-y-3">
          {questions.map((q, i) => {
            const correct = answers[q.id] === q.correctAnswer;
            return (
              <div key={q.id} className={`rounded-xl p-3 text-left text-sm ${correct ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                <p className="font-medium">{i + 1}. {q.question}</p>
                <p className={`text-xs mt-1 ${correct ? "text-green-600" : "text-red-600"}`}>
                  {correct ? t("correct") : t("incorrect")}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Progress dots */}
      <div className="flex items-center justify-center gap-1.5">
        {questions.map((_, i) => (
          <div key={i} className={`h-2 w-2 rounded-full ${i === current ? "bg-primary" : i < current ? "bg-primary/40" : "bg-outline-variant/30"}`} />
        ))}
      </div>

      <h3 className="text-lg font-semibold text-on-surface">{q.question}</h3>

      {q.type === "multiple_choice" ? (
        <div className="space-y-2">
          {q.options.map((opt) => {
            const selected = answers[q.id] === opt.id;
            let bg = "border-outline-variant/20 hover:border-primary/30";
            if (checked) {
              if (opt.id === q.correctAnswer) bg = "border-green-500 bg-green-50";
              else if (selected) bg = "border-red-500 bg-red-50";
            } else if (selected) {
              bg = "border-primary bg-primary/5";
            }
            return (
              <button
                key={opt.id}
                onClick={() => handleAnswer(opt.id)}
                className={`w-full text-left rounded-xl border-2 p-3 text-sm transition-all ${bg}`}
              >
                {opt.text}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex gap-4">
          {["true", "false"].map((val) => {
            const selected = answers[q.id] === val;
            let bg = "border-outline-variant/20 hover:border-primary/30";
            if (checked) {
              if (val === q.correctAnswer) bg = "border-green-500 bg-green-50";
              else if (selected) bg = "border-red-500 bg-red-50";
            } else if (selected) {
              bg = "border-primary bg-primary/5";
            }
            return (
              <button
                key={val}
                onClick={() => handleAnswer(val)}
                className={`flex-1 rounded-xl border-2 p-3 text-sm font-medium transition-all ${bg}`}
              >
                {val === "true" ? "True" : "False"}
              </button>
            );
          })}
        </div>
      )}

      {/* Explanation */}
      {checked && q.explanation && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
          {q.explanation}
        </div>
      )}

      <div className="flex justify-end">
        {!checked ? (
          <button
            onClick={handleCheck}
            disabled={!answers[q.id]}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-on-primary hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {t("checkAnswers")}
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
          >
            {current < questions.length - 1 ? t("nextQuestion") : "See Results"}
          </button>
        )}
      </div>
    </div>
  );
}
