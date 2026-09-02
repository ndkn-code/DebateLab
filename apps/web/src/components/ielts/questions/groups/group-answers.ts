/**
 * Pure helpers behind the group surfaces (no React, no DOM) — layout dispatch,
 * slot lookup, bank labels, verdict states. Unit-tested in `group-answers.test.ts`.
 */
import type { IeltsResponseMap } from "@/lib/ielts/question-contract";
import type { GroupPartBlock, QuestionNumber } from "@/lib/ielts/question-groups";
import { groupSlotValue } from "@/lib/ielts/question-groups";
import {
  DEFAULT_BLANK_ID,
  type IeltsOption,
  type IeltsQuestionGroupView,
  type IeltsVerdict,
} from "@/lib/ielts/question-types";
import type { ChoiceState } from "../ChoiceTile";
import type { GroupLayout, SlotRef } from "./types";

/** Minimal member shape the helpers need (the player view satisfies it). */
export interface GroupMemberLike {
  id: string;
  family: string;
  prompt: string;
  wordLimit: number | null;
  selectCount?: number | null;
}

export interface GroupBlockLike {
  group: Pick<IeltsQuestionGroupView, "stimulus" | "bank" | "answerMode">;
  questions: readonly GroupMemberLike[];
  numbers: readonly QuestionNumber[];
  slotByQuestionId: Record<string, string>;
}

/**
 * Which surface renders a block: an all-`mcq_multi` run is a multi-select set;
 * otherwise the stimulus kind decides, and a bank-only group (no stimulus) is a
 * matching list.
 */
export function resolveGroupLayout(block: GroupBlockLike): GroupLayout {
  if (
    block.questions.length > 0 &&
    block.questions.every((question) => question.family === "multi_select")
  ) {
    return "multi_select";
  }
  const stimulus = block.group.stimulus;
  if (!stimulus) return "matching";
  return stimulus.kind;
}

/** Bank-driven blanks (drag / pick) vs typed text. */
export function isSelectGroup(
  group: Pick<IeltsQuestionGroupView, "bank" | "answerMode">,
): boolean {
  return group.answerMode === "select" && group.bank.length > 0;
}

/** Members in display order, each with its slot id and question number. */
export function buildSlotRefs(block: GroupBlockLike): SlotRef[] {
  return block.questions.map((question, index) => {
    const number = block.numbers[index] ?? {
      questionId: question.id,
      start: index + 1,
      end: index + 1,
      label: String(index + 1),
    };
    return {
      questionId: question.id,
      slot: block.slotByQuestionId[question.id] ?? String(index + 1),
      number,
      prompt: question.prompt,
      wordLimit: question.wordLimit,
    };
  });
}

/** slot id → member; a duplicated slot keeps its first owner. */
export function indexSlotRefs(refs: readonly SlotRef[]): Map<string, SlotRef> {
  const map = new Map<string, SlotRef>();
  for (const ref of refs) if (!map.has(ref.slot)) map.set(ref.slot, ref);
  return map;
}

export function findBankOption(
  bank: readonly IeltsOption[],
  optionId: string | null,
): IeltsOption | undefined {
  if (optionId === null) return undefined;
  return bank.find((option) => option.id === optionId);
}

/** "B" for a labelled option, else its text, else the raw id. */
export function bankOptionLabel(
  bank: readonly IeltsOption[],
  optionId: string | null,
): string {
  const option = findBankOption(bank, optionId);
  if (!option) return optionId ?? "";
  return option.label ?? option.text ?? option.id;
}

/** "B. Text" — the full chip/legend label. */
export function bankOptionFullLabel(option: IeltsOption): string {
  return option.label && option.text ? `${option.label}. ${option.text}` : option.text || option.label || option.id;
}

/** Review state of one member's single blank. */
export function slotVerdictState(
  verdicts: Record<string, IeltsVerdict> | undefined,
  questionId: string,
): ChoiceState {
  const blank = verdicts?.[questionId]?.blanks[DEFAULT_BLANK_ID];
  if (!blank) return "idle";
  return blank.correct ? "correct" : "incorrect";
}

/** Whether a bank option may be dropped/picked into `questionId`'s blank. */
export function canPlaceOption(
  group: Pick<IeltsQuestionGroupView, "bankReuse">,
  responses: IeltsResponseMap,
  used: ReadonlySet<string>,
  questionId: string,
  optionId: string,
): boolean {
  if (group.bankReuse) return true;
  if (!used.has(optionId)) return true;
  return groupSlotValue(responses, questionId) === optionId;
}

/** `chooseCount` for a multi-select set: the first member's `selectCount`. */
export function groupSelectCount(block: GroupBlockLike): number | null {
  for (const question of block.questions) {
    if (typeof question.selectCount === "number") return question.selectCount;
  }
  return null;
}

/** Range bounds of a group block (for the i18n heading). */
export function blockNumberRange(block: Pick<GroupPartBlock, "numbers">): {
  first: number;
  last: number;
} {
  const starts = block.numbers.map((n) => n.start);
  const ends = block.numbers.map((n) => n.end);
  return { first: Math.min(...starts), last: Math.max(...ends) };
}
