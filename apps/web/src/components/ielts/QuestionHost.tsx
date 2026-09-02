"use client";

/**
 * Renders one IELTS question via the WS-1.2 renderer registry (WS-2.1). Owns the
 * prompt/number chrome; delegates answer capture to the registered (or fallback)
 * renderer through the typed contract.
 *
 * `variant="row"` is the compact numbered row used inside `SpeakingQuestionList`
 * (Part 1 / Part 3); the default `"card"` keeps the historical bordered block.
 * `numberLabel` overrides the displayed number (e.g. "21–22" for a span).
 */
import type { IeltsQuestionView } from "@/lib/ielts/question-contract";
import { isObjectiveQuestionType } from "@/lib/ielts/question-types";
import {
  getIeltsQuestionRenderer,
  type IeltsRendererContext,
} from "./question-renderer-registry";
import { FlagToggle } from "./questions/FlagToggle";
import { ensureIeltsTaskRenderersRegistered } from "./questions/register-task-renderers";
import { QuestionHighlighter } from "./QuestionHighlighter";

// Register the Writing/Speaking capture surfaces before any renderer is resolved.
ensureIeltsTaskRenderersRegistered();

export type QuestionHostVariant = "card" | "row";

function QuestionPrompt({ question }: { question: IeltsQuestionView }) {
  return (
    <>
      <p className="text-sm font-medium text-on-surface">{question.prompt}</p>
      {question.wordLimit !== null ? (
        <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-on-surface-variant">
          Write no more than {question.wordLimit}{" "}
          {question.wordLimit === 1 ? "word" : "words"}
        </p>
      ) : null}
    </>
  );
}

export function QuestionHost({
  question,
  number,
  numberLabel,
  value,
  disabled,
  onChange,
  context,
  allowFlag = false,
  onOpenNotes,
  variant = "card",
}: {
  question: IeltsQuestionView;
  number: number;
  /** Display override for the number badge (e.g. "21–22" for numberSpan rows). */
  numberLabel?: string;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
  context?: IeltsRendererContext;
  allowFlag?: boolean;
  onOpenNotes?: (noteId: string) => void;
  variant?: QuestionHostVariant;
}) {
  const renderQuestion = getIeltsQuestionRenderer(question.questionType);
  const objective = isObjectiveQuestionType(question.questionType);
  // A Part 2 cue card renders its own boxed prompt; the raw text would repeat it.
  const showPrompt = !objective && question.cueCard === null;
  const renderer = renderQuestion({
    question,
    value,
    disabled,
    onChange,
    context,
  });
  const row = variant === "row";

  return (
    <div
      id={`mock-q-${question.id}`}
      className={
        row
          ? "scroll-mt-24 px-4 py-3"
          : "scroll-mt-24 rounded-xl border border-outline-variant bg-surface-container p-5"
      }
    >
      <div className="flex items-start gap-3">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <span
            className={
              row
                ? "flex h-6 min-w-6 items-center justify-center rounded-full bg-surface-container-high px-1.5 text-xs font-semibold tabular-nums text-on-surface"
                : "flex h-7 min-w-7 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold tabular-nums text-on-primary"
            }
          >
            {numberLabel ?? number}
          </span>
          {allowFlag ? (
            <FlagToggle questionId={question.id} size={row ? "sm" : "md"} />
          ) : null}
        </div>
        <QuestionHighlighter questionId={question.id} onOpenNotes={onOpenNotes}>
          {objective ? (
            renderer
          ) : (
            <>
              {showPrompt ? <QuestionPrompt question={question} /> : null}
              <div className={showPrompt ? "mt-3" : undefined}>{renderer}</div>
            </>
          )}
        </QuestionHighlighter>
      </div>
    </div>
  );
}
