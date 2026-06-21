import type { IeltsSkill } from "@/lib/ielts/adaptive/contracts";
import type { Tables } from "@/types/supabase";

export type IeltsReviewSessionItemRow = Pick<
  Tables<"ielts_review_items">,
  | "id"
  | "skill"
  | "focus_area"
  | "review_kind"
  | "prompt_en"
  | "prompt_vi"
  | "answer_en"
  | "answer_vi"
  | "due_at"
  | "state"
>;

export interface IeltsReviewSessionItemView {
  id: string;
  skill: IeltsSkill;
  focusArea: string;
  reviewKind: string;
  promptEn: string;
  promptVi: string;
  answerEn: string | null;
  answerVi: string | null;
  dueAt: string;
  state: string;
  isOverdue: boolean;
  position: number;
}

export interface IeltsReviewSessionView {
  generatedAt: string;
  dueCount: number;
  items: IeltsReviewSessionItemView[];
}

function compareDueAt(
  a: IeltsReviewSessionItemRow,
  b: IeltsReviewSessionItemRow,
): number {
  if (a.due_at !== b.due_at) return a.due_at < b.due_at ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function buildIeltsReviewSessionView(
  rows: readonly IeltsReviewSessionItemRow[],
  options: { now: string },
): IeltsReviewSessionView {
  const items = [...rows]
    .sort(compareDueAt)
    .map((row, index): IeltsReviewSessionItemView => ({
      id: row.id,
      skill: row.skill,
      focusArea: row.focus_area,
      reviewKind: row.review_kind,
      promptEn: row.prompt_en,
      promptVi: row.prompt_vi,
      answerEn: row.answer_en,
      answerVi: row.answer_vi,
      dueAt: row.due_at,
      state: row.state,
      isOverdue: row.due_at.slice(0, 10) < options.now.slice(0, 10),
      position: index + 1,
    }));

  return {
    generatedAt: options.now,
    dueCount: items.length,
    items,
  };
}
