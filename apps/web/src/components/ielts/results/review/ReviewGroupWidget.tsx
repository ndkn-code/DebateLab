"use client";

/**
 * A grouped set (shared bank / summary / table / flow-chart / diagram) in
 * review: the exam widget re-rendered read-only in `verdict` mode over the
 * learner's saved answers, followed by the per-blank answer rows (the widget
 * marks right/wrong but never reveals the key — the rows do). Falls back to
 * plain rows when the part lacks the player-shaped question views.
 */
import { useMemo } from "react";
import { QuestionGroupHost } from "@/components/ielts/questions/groups";
import type { IeltsResponseMap } from "@/lib/ielts/question-contract";
import {
  partitionPartQuestions,
  resolveNumberSpan,
  type GroupPartBlock,
  type QuestionNumber,
} from "@/lib/ielts/question-groups";
import type { IeltsQuestionGroupView, IeltsVerdict } from "@/lib/ielts/question-types";
import type {
  ObjectiveReviewItem,
  ObjectiveReviewPart,
} from "@/lib/ielts/results/types";
import { ReviewRow } from "./ReviewRow";

const noop = () => {};

function buildBlocks(
  part: ObjectiveReviewPart,
  group: IeltsQuestionGroupView,
  items: ObjectiveReviewItem[],
): GroupPartBlock[] | null {
  const byId = new Map(part.questions.map((question) => [question.id, question]));
  const questions = items.map((item) => byId.get(item.questionId));
  if (questions.some((question) => question === undefined)) return null;
  const present = questions.filter(
    (question): question is NonNullable<typeof question> => question !== undefined,
  );
  const numbers = new Map<string, QuestionNumber>(
    items.map((item, index) => {
      const span = resolveNumberSpan(present[index]);
      return [
        item.questionId,
        {
          questionId: item.questionId,
          start: item.number,
          end: item.number + span - 1,
          label: item.numberLabel,
        },
      ];
    }),
  );
  const blocks = partitionPartQuestions(
    present,
    new Map([[group.groupKey, group]]),
    numbers,
  ).filter((block): block is GroupPartBlock => block.kind === "group");
  return blocks.length > 0 ? blocks : null;
}

export function ReviewGroupWidget({
  part,
  group,
  items,
  responses,
}: {
  part: ObjectiveReviewPart;
  group: IeltsQuestionGroupView;
  items: ObjectiveReviewItem[];
  responses: IeltsResponseMap;
}) {
  const blocks = useMemo(() => buildBlocks(part, group, items), [part, group, items]);
  const verdicts = useMemo(() => {
    const out: Record<string, IeltsVerdict> = {};
    for (const item of items) if (item.verdict) out[item.questionId] = item.verdict;
    return out;
  }, [items]);

  if (!blocks) {
    return (
      <ul className="flex flex-col gap-2">
        {items.map((item, index) => (
          <ReviewRow
            key={item.questionId}
            item={item}
            instructions={index === 0 ? item.groupInstructions : null}
          />
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block) => (
        <QuestionGroupHost
          key={`review-group-${block.group.groupKey}-${block.questions[0]?.id ?? ""}`}
          block={block}
          responses={responses}
          onAnswer={noop}
          disabled
          mode="verdict"
          verdicts={verdicts}
        />
      ))}
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <ReviewRow key={item.questionId} item={item} showPrompt={!group.stimulus} />
        ))}
      </ul>
    </div>
  );
}
