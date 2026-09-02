/**
 * Pure "does this question fit its group?" check (format-variety pass).
 *
 * Runs at the canonical question create/update path when the question names a
 * `groupKey` that resolves to an `ielts_question_groups` row. It mirrors what
 * the player relies on at render time (`parseQuestionGroupView`): the row's
 * slot must be unique within the group, matching sets need a bank, labelling
 * sets need a hotspot for the slot, and `any_order` sets must share one accept
 * set so the grader can accept the answers in any order.
 *
 * No I/O — the repository loads the group + siblings and hands them in.
 */
import type { Json, Tables } from "@/types/supabase";
import {
  defaultSlotForPosition,
  normalizeGroupBank,
  normalizeGroupStimulus,
} from "@/lib/ielts/question-types/groups";
import { parseQuestionMetadata } from "@/lib/ielts/question-types/metadata";
import { normalizeAnswerKey } from "./normalize";
import type { IeltsQuestionType, NormalizedQuestionInput } from "./question-schema";

export type QuestionGroupRow = Tables<"ielts_question_groups">;

/** A sibling question already in the group (its key is read server-side). */
export interface GroupSiblingLike {
  id?: string;
  metadata: unknown;
  correctAnswer: unknown;
  /** Display order; when absent the sibling is assumed to precede the question. */
  orderIndex?: number | null;
}

const MATCHING_TYPES = new Set<IeltsQuestionType>([
  "matching_headings",
  "matching_information",
  "matching_features",
  "matching_sentence_endings",
]);
const LABELING_TYPES = new Set<IeltsQuestionType>(["diagram_label", "map_plan_label"]);

interface Member {
  self: boolean;
  orderIndex: number;
  metadata: unknown;
  correctAnswer: unknown;
}

/** Members in display order: siblings by order_index, the question after ties. */
function orderMembers(
  question: NormalizedQuestionInput,
  siblings: readonly GroupSiblingLike[],
): Member[] {
  const members: Member[] = siblings.map((s) => ({
    self: false,
    orderIndex: s.orderIndex ?? Number.NEGATIVE_INFINITY,
    metadata: s.metadata,
    correctAnswer: s.correctAnswer,
  }));
  members.push({
    self: true,
    orderIndex: question.orderIndex,
    metadata: question.metadata,
    correctAnswer: question.correctAnswer,
  });
  // Stable sort keeps the question after siblings with the same order_index.
  return members.sort((a, b) => a.orderIndex - b.orderIndex);
}

/** Every answer token in a key (string, list, or per-blank record), normalized. */
export function acceptSetOf(correctAnswer: unknown): Set<string> {
  const out = new Set<string>();
  const visit = (value: unknown) => {
    if (typeof value === "string") {
      const norm = normalizeAnswerKey(value);
      if (norm) out.add(norm);
    } else if (Array.isArray(value)) {
      value.forEach(visit);
    } else if (value && typeof value === "object") {
      Object.values(value as Record<string, Json>).forEach(visit);
    }
  };
  visit(correctAnswer);
  return out;
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

function fail(group: QuestionGroupRow, message: string): never {
  throw new Error(`Question does not fit group "${group.group_key}": ${message}`);
}

function checkSlots(
  group: QuestionGroupRow,
  members: Member[],
): { slot: string } {
  const seen = new Map<string, number>();
  let selfSlot = "";
  members.forEach((member, index) => {
    const slot = parseQuestionMetadata(member.metadata).slot ?? defaultSlotForPosition(index);
    if (member.self) selfSlot = slot;
    seen.set(slot, (seen.get(slot) ?? 0) + 1);
  });
  if ((seen.get(selfSlot) ?? 0) > 1) {
    fail(group, `slot "${selfSlot}" is already used by another question in the group`);
  }
  return { slot: selfSlot };
}

function checkMatching(group: QuestionGroupRow, question: NormalizedQuestionInput): void {
  const bank = normalizeGroupBank(group.bank);
  const items = parseQuestionMetadata(question.metadata).items ?? [];
  if (bank.length === 0 && items.length === 0) {
    fail(group, `${question.questionType} needs a non-empty group bank or metadata.items`);
  }
}

function checkLabeling(group: QuestionGroupRow, question: NormalizedQuestionInput, slot: string): void {
  const stimulus = normalizeGroupStimulus(group.stimulus);
  if (stimulus?.kind !== "image") {
    fail(group, `${question.questionType} needs an image stimulus on the group`);
  }
  if (!stimulus.hotspots.some((h) => h.id === slot)) {
    fail(group, `image stimulus has no hotspot for slot "${slot}"`);
  }
}

function checkAnyOrder(
  group: QuestionGroupRow,
  question: NormalizedQuestionInput,
  siblings: readonly GroupSiblingLike[],
): void {
  const mine = acceptSetOf(question.correctAnswer);
  for (const sibling of siblings) {
    if (!sameSet(mine, acceptSetOf(sibling.correctAnswer))) {
      fail(group, "any_order groups need every member key to accept the same set of answers");
    }
  }
}

/**
 * Throw a descriptive Error when `question` cannot join `group` alongside
 * `siblings` (the group's other members, excluding the question itself on
 * update). Returns the resolved slot on success.
 */
export function assertQuestionFitsGroup(
  question: NormalizedQuestionInput,
  group: QuestionGroupRow,
  siblings: readonly GroupSiblingLike[],
): { slot: string } {
  if (group.skill !== question.skill) {
    fail(group, `group skill is ${group.skill} but the question skill is ${question.skill}`);
  }
  if (group.test_id !== question.testId) {
    fail(group, "group belongs to a different test");
  }
  const { slot } = checkSlots(group, orderMembers(question, siblings));
  if (MATCHING_TYPES.has(question.questionType)) checkMatching(group, question);
  if (LABELING_TYPES.has(question.questionType)) checkLabeling(group, question, slot);
  if (group.any_order) checkAnyOrder(group, question, siblings);
  return { slot };
}
