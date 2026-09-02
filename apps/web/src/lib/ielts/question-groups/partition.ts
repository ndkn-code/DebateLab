/**
 * Partition a part's flat question list into renderable blocks — see
 * `./types.ts` for the block shapes and the grouping rules.
 */
import {
  defaultSlotForPosition,
  stimulusSlots,
  type IeltsQuestionGroupView,
} from "@/lib/ielts/question-types/groups";
import { parseQuestionMetadata } from "@/lib/ielts/question-types/metadata";
import { formatQuestionRange, formatQuestionsHeading } from "./numbering";
import type {
  GroupPartBlock,
  PartBlock,
  PartitionQuestionLike,
  QuestionNumber,
  StimulusSlotCoverage,
} from "./types";

/** Explicit `slot`, else `metadata.slot`, else the 1-based position in the block. */
export function resolveQuestionSlot(
  question: PartitionQuestionLike,
  index: number,
): string {
  if (typeof question.slot === "string" && question.slot.length > 0) return question.slot;
  const fromMeta = parseQuestionMetadata(question.metadata).slot;
  return fromMeta ?? defaultSlotForPosition(index);
}

/** questionId → slot for the members of one block, in the order given. */
export function resolveBlockSlots(
  questions: readonly PartitionQuestionLike[],
): Record<string, string> {
  const out: Record<string, string> = {};
  questions.forEach((question, index) => {
    out[question.id] = resolveQuestionSlot(question, index);
  });
  return out;
}

/** Numbering fallback when a question is absent from the section map. */
function fallbackNumber(questionId: string, position: number): QuestionNumber {
  const n = position + 1;
  return { questionId, start: n, end: n, label: formatQuestionRange(n, n) };
}

function buildGroupBlock<Q extends PartitionQuestionLike>(
  group: IeltsQuestionGroupView,
  questions: Q[],
  numbers: QuestionNumber[],
): GroupPartBlock<Q> {
  const slotByQuestionId = resolveBlockSlots(questions);
  const start = Math.min(...numbers.map((n) => n.start));
  const end = Math.max(...numbers.map((n) => n.end));
  return {
    kind: "group",
    group: { ...group, questionIds: questions.map((q) => q.id), slotByQuestionId },
    questions,
    numbers,
    slotByQuestionId,
    rangeLabel: formatQuestionsHeading(start, end),
  };
}

/**
 * Consecutive questions whose non-null `groupKey` resolves to a group view
 * form one `group` block, in the order given. A `groupKey` with no view, a
 * null key, or a change of key ends the run; an interleaved foreign question
 * splits a group into two blocks (the second re-derives slots from its own
 * members, so author explicit `metadata.slot` when order is not enough).
 */
export function partitionPartQuestions<Q extends PartitionQuestionLike>(
  questions: readonly Q[],
  groupsByKey: ReadonlyMap<string, IeltsQuestionGroupView>,
  numbers: ReadonlyMap<string, QuestionNumber>,
): PartBlock<Q>[] {
  const blocks: PartBlock<Q>[] = [];
  let run: { group: IeltsQuestionGroupView; questions: Q[]; numbers: QuestionNumber[] } | null =
    null;

  const flush = () => {
    if (run) blocks.push(buildGroupBlock(run.group, run.questions, run.numbers));
    run = null;
  };

  questions.forEach((question, position) => {
    const number = numbers.get(question.id) ?? fallbackNumber(question.id, position);
    const group = question.groupKey ? groupsByKey.get(question.groupKey) : undefined;
    if (!group) {
      flush();
      blocks.push({ kind: "single", question, number });
      return;
    }
    if (run && run.group.groupKey !== group.groupKey) flush();
    if (!run) run = { group, questions: [], numbers: [] };
    run.questions.push(question);
    run.numbers.push(number);
  });
  flush();
  return blocks;
}

/**
 * Compare the slots a group's stimulus references with the slots its members
 * fill. A group without a stimulus (bank-only matching) has nothing to cover,
 * so both lists are empty.
 */
export function stimulusSlotCoverage(
  block: Pick<GroupPartBlock<PartitionQuestionLike>, "group" | "slotByQuestionId">,
): StimulusSlotCoverage {
  if (!block.group.stimulus) return { missing: [], extra: [] };
  const referenced = stimulusSlots(block.group.stimulus);
  const referencedSet = new Set(referenced);
  const filled = new Set(Object.values(block.slotByQuestionId));
  return {
    missing: [...new Set(referenced)].filter((slot) => !filled.has(slot)),
    extra: [...filled].filter((slot) => !referencedSet.has(slot)),
  };
}

/** First question number of a block, for chips / scroll anchors. */
export function blockStartNumber(block: PartBlock<PartitionQuestionLike>): number {
  return block.kind === "single"
    ? block.number.start
    : Math.min(...block.numbers.map((n) => n.start));
}
