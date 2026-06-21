"use client";

/**
 * Renders one IELTS question via the WS-1.2 renderer registry (WS-2.1). Owns the
 * prompt/number chrome; delegates answer capture to the registered (or fallback)
 * renderer through the typed contract.
 */
import type { IeltsQuestionView } from "@/lib/ielts/question-contract";
import { isObjectiveQuestionType } from "@/lib/ielts/question-types";
import {
  getIeltsQuestionRenderer,
  type IeltsRendererContext,
} from "./question-renderer-registry";
import { ensureIeltsTaskRenderersRegistered } from "./questions/register-task-renderers";

// Register the Writing/Speaking capture surfaces before any renderer is resolved.
ensureIeltsTaskRenderersRegistered();

export function QuestionHost({
  question,
  number,
  value,
  disabled,
  onChange,
  context,
}: {
  question: IeltsQuestionView;
  number: number;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
  context?: IeltsRendererContext;
}) {
  const renderQuestion = getIeltsQuestionRenderer(question.questionType);
  const objective = isObjectiveQuestionType(question.questionType);
  const renderer = renderQuestion({ question, value, disabled, onChange, context });

  return (
    <div className="flex flex-col gap-3 rounded-3xl border border-outline-variant bg-surface-container p-5">
      <div className="flex items-start gap-3">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary">
          {number}
        </span>
        <div className="min-w-0 flex-1">
          {objective ? (
            renderer
          ) : (
            <>
              <p className="text-sm font-medium text-on-surface">{question.prompt}</p>
              {question.wordLimit !== null ? (
                <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
                  Write no more than {question.wordLimit}{" "}
                  {question.wordLimit === 1 ? "word" : "words"}
                </p>
              ) : null}
              <div className="mt-3">{renderer}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
