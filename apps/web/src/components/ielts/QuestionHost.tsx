"use client";

/**
 * Renders one IELTS question via the WS-1.2 renderer registry (WS-2.1). Owns the
 * prompt/number chrome; delegates answer capture to the registered (or fallback)
 * renderer through the typed contract.
 */
import type { IeltsQuestionView } from "@/lib/ielts/question-contract";
import { isObjectiveQuestionType } from "@/lib/ielts/question-types";
import {
  mockAnnotationKey,
  useMockAnnotationsStore,
} from "@/lib/stores/mockAnnotationsStore";
import { Bookmark, BookmarkCheck } from "@/components/ui/icons";
import {
  getIeltsQuestionRenderer,
  type IeltsRendererContext,
} from "./question-renderer-registry";
import { ensureIeltsTaskRenderersRegistered } from "./questions/register-task-renderers";
import { QuestionHighlighter } from "./QuestionHighlighter";

// Register the Writing/Speaking capture surfaces before any renderer is resolved.
ensureIeltsTaskRenderersRegistered();

export function QuestionHost({
  question,
  number,
  value,
  disabled,
  onChange,
  context,
  allowFlag = false,
  onOpenNotes,
}: {
  question: IeltsQuestionView;
  number: number;
  value: unknown;
  disabled: boolean;
  onChange: (value: unknown) => void;
  context?: IeltsRendererContext;
  allowFlag?: boolean;
  onOpenNotes?: (noteId: string) => void;
}) {
  const renderQuestion = getIeltsQuestionRenderer(question.questionType);
  const objective = isObjectiveQuestionType(question.questionType);
  const renderer = renderQuestion({ question, value, disabled, onChange, context });
  const isFlagged = useMockAnnotationsStore((store) => {
    if (!store.activeAttemptId) return false;
    return store.flags[mockAnnotationKey(store.activeAttemptId, question.id)] === true;
  });
  const toggleFlag = useMockAnnotationsStore((store) => store.toggleFlag);
  const FlagIcon = isFlagged ? BookmarkCheck : Bookmark;

  return (
    <div
      id={`mock-q-${question.id}`}
      className="scroll-mt-24 rounded-3xl border border-outline-variant bg-surface-container p-5"
    >
      <div className="flex items-start gap-3">
        <div className="flex shrink-0 flex-col items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary">
            {number}
          </span>
          {allowFlag ? (
            <button
              type="button"
              onClick={() => toggleFlag(question.id)}
              aria-pressed={isFlagged}
              title={isFlagged ? "Remove flag" : "Flag for review"}
              className={`flex size-7 items-center justify-center rounded-full border transition active:scale-95 ${
                isFlagged
                  ? "border-warning bg-warning-container text-on-warning-container"
                  : "border-outline-variant bg-surface text-on-surface-variant hover:border-warning hover:text-warning"
              }`}
            >
              <FlagIcon className="size-3.5" aria-hidden="true" />
              <span className="sr-only">
                {isFlagged ? "Remove flag" : "Flag for review"}
              </span>
            </button>
          ) : null}
        </div>
        <QuestionHighlighter questionId={question.id} onOpenNotes={onOpenNotes}>
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
        </QuestionHighlighter>
      </div>
    </div>
  );
}
