"use client";

/**
 * Renders one IELTS question via the WS-1.2 renderer registry (WS-2.1). Owns the
 * prompt/number chrome; delegates answer capture to the registered (or fallback)
 * renderer through the typed contract.
 */
import type { IeltsQuestionView } from "@/lib/ielts/question-contract";
import { getIeltsQuestionRenderer } from "./question-renderer-registry";

export function QuestionHost({
  question,
  number,
  value,
  disabled,
  onChange,
}: {
  question: IeltsQuestionView;
  number: number;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
}) {
  const renderQuestion = getIeltsQuestionRenderer(question.questionType);
  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-outline-variant bg-surface-container p-5">
      <div className="flex items-baseline gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary">
          {number}
        </span>
        <p className="text-sm font-medium text-on-surface">{question.prompt}</p>
      </div>
      {question.wordLimit !== null ? (
        <p className="pl-10 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          Write no more than {question.wordLimit}{" "}
          {question.wordLimit === 1 ? "word" : "words"}
        </p>
      ) : null}
      <div className="pl-10">
        {renderQuestion({ question, value, disabled, onChange })}
      </div>
    </div>
  );
}
