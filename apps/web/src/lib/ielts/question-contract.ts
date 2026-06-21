/**
 * The learner-facing question contract (WS-2.1) — the typed, NON-secret view of
 * an `ielts_questions` row that the mock player passes to a renderer. This is
 * the interface WS-1.2 builds its per-type renderers/validators against; the
 * mock engine builds *against this contract* and integrates 1.2's registered
 * renderers at merge (until then a fallback renderer is used).
 *
 * Answer keys (correct answers, accept-variants, explanations) are deliberately
 * absent — they live in `ielts_question_keys`, readable only by the service-role
 * grader, never shipped to the client.
 */
import type { Enums } from "@/types/supabase";
import type {
  IeltsQuestionView as ObjectiveQuestionView,
} from "@/lib/ielts/question-types";

export type IeltsQuestionType = Enums<"ielts_question_type">;
export type IeltsSkill = Enums<"ielts_skill">;

/**
 * Non-secret question fields a renderer needs to present + capture an answer.
 * The objective renderer surface owns the typed prompt/options/items/visual
 * shape; the mock player adds placement fields for section/part navigation.
 */
export interface IeltsQuestionView extends ObjectiveQuestionView {
  orderIndex: number;
  /** Items that share a stem (e.g. a matching set / summary) group by this key. */
  groupKey: string | null;
  passageId: string | null;
  listeningSectionId: string | null;
}

/** A learner's in-progress answer for one question (the response JSON envelope). */
export type IeltsQuestionResponseValue = unknown;

/** Map of questionId → current response, as held by the player and persisted. */
export type IeltsResponseMap = Record<string, IeltsQuestionResponseValue>;
