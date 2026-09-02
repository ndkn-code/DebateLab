"use client";

/**
 * A run of `mcq_multi` rows ("Questions 21–22: choose TWO letters"). Each row
 * keeps the family renderer; the group header carries the shared rubric.
 */
import { coerceObjectiveAnswer } from "../../question-renderer-registry";
import { FlagToggle } from "../FlagToggle";
import { MultiSelectRenderer } from "../MultiSelectRenderer";
import { useGroupContext } from "./group-context";
import { NumberBadge } from "./NumberedBlank";

export function MultiSelectGroup({
  onAnswer,
}: {
  onAnswer: (questionId: string, value: unknown) => void;
}) {
  const ctx = useGroupContext();
  return (
    <div className="flex flex-col gap-3">
      {ctx.block.questions.map((question, index) => {
        const number = ctx.block.numbers[index];
        return (
          <div
            key={question.id}
            id={`mock-q-${question.id}`}
            className="flex scroll-mt-24 items-start gap-3"
          >
            <div className="flex shrink-0 flex-col items-center gap-1.5">
              <NumberBadge label={number?.label ?? String(index + 1)} size="md" />
              {ctx.mode === "answer" ? <FlagToggle questionId={question.id} /> : null}
            </div>
            <div className="min-w-0 flex-1">
              <MultiSelectRenderer
                question={{ ...question, groupInstructions: null }}
                value={coerceObjectiveAnswer(question, ctx.responses[question.id])}
                onChange={(next) => onAnswer(question.id, next)}
                disabled={ctx.locked}
                verdict={ctx.verdicts?.[question.id] ?? null}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
