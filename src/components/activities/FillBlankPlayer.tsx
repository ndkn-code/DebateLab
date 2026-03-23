"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { FillBlankContent, ActivityContent } from "@/lib/types/admin";

interface Props {
  content: ActivityContent;
  onComplete: (score: number, maxScore: number, responses: Record<string, unknown>) => void;
}

export function FillBlankPlayer({ content, onComplete }: Props) {
  const t = useTranslations("courses.player");
  const c = content as FillBlankContent;
  const passages = c.passages ?? [];
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);

  const handleCheck = () => {
    setChecked(true);
    let score = 0;
    let total = 0;
    for (const passage of passages) {
      for (const blank of passage.blanks) {
        total++;
        const userAnswer = answers[blank.id] ?? "";
        const correct = blank.caseSensitive
          ? userAnswer === blank.answer || (blank.acceptedAnswers ?? []).includes(userAnswer)
          : userAnswer.toLowerCase() === blank.answer.toLowerCase() || (blank.acceptedAnswers ?? []).some((a) => a.toLowerCase() === userAnswer.toLowerCase());
        if (correct) score++;
      }
    }
    onComplete(score, total, answers);
  };

  const isBlankCorrect = (blankId: string, blank: FillBlankContent["passages"][0]["blanks"][0]) => {
    const userAnswer = answers[blankId] ?? "";
    return blank.caseSensitive
      ? userAnswer === blank.answer || (blank.acceptedAnswers ?? []).includes(userAnswer)
      : userAnswer.toLowerCase() === blank.answer.toLowerCase() || (blank.acceptedAnswers ?? []).some((a) => a.toLowerCase() === userAnswer.toLowerCase());
  };

  const renderPassage = (passage: FillBlankContent["passages"][0]) => {
    const parts = passage.text.split(/(__BLANK_\d+__)/g);
    return parts.map((part, i) => {
      const match = part.match(/__BLANK_(\d+)__/);
      if (!match) return <span key={i}>{part}</span>;
      const num = parseInt(match[1]);
      const blank = passage.blanks.find((b) => b.id === `blank-${num}`);
      if (!blank) return <span key={i}>{part}</span>;

      const correct = checked ? isBlankCorrect(blank.id, blank) : undefined;
      return (
        <span key={i} className="inline-block mx-1">
          <input
            value={answers[blank.id] ?? ""}
            onChange={(e) => setAnswers((prev) => ({ ...prev, [blank.id]: e.target.value }))}
            disabled={checked}
            className={`w-32 border-b-2 px-1 py-0.5 text-sm text-center focus:outline-none ${
              checked
                ? correct ? "border-green-500 bg-green-50 text-green-700" : "border-red-500 bg-red-50 text-red-700"
                : "border-primary/40 focus:border-primary"
            }`}
          />
          {checked && !correct && (
            <span className="text-xs text-green-600 ml-1">({blank.answer})</span>
          )}
        </span>
      );
    });
  };

  return (
    <div className="space-y-6">
      {passages.map((passage, i) => (
        <div key={passage.id} className="text-base leading-8 text-on-surface">
          {renderPassage(passage)}
        </div>
      ))}

      {!checked && (
        <div className="flex justify-end">
          <button
            onClick={handleCheck}
            className="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-on-primary hover:bg-primary/90 transition-colors"
          >
            {t("checkAnswers")}
          </button>
        </div>
      )}
    </div>
  );
}
