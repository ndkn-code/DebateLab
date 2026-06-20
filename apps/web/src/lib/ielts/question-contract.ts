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

export type IeltsQuestionType = Enums<"ielts_question_type">;
export type IeltsSkill = Enums<"ielts_skill">;

/** Non-secret question fields a renderer needs to present + capture an answer. */
export interface IeltsQuestionView {
  id: string;
  skill: IeltsSkill;
  questionType: IeltsQuestionType;
  orderIndex: number;
  /** Items that share a stem (e.g. a matching set / summary) group by this key. */
  groupKey: string | null;
  groupInstructions: string | null;
  prompt: string;
  /** Choices / candidate headings / features / bank labels (non-secret JSON). */
  options: unknown;
  maxPoints: number;
  /** "NO MORE THAN N WORDS" cap for completion/short-answer items. */
  wordLimit: number | null;
  /** Diagram / map / chart data (lesson-chunk shape) for label items. */
  visual: unknown;
  passageId: string | null;
  listeningSectionId: string | null;
}

/** A learner's in-progress answer for one question (the response JSON envelope). */
export type IeltsQuestionResponseValue = unknown;

/** Map of questionId → current response, as held by the player and persisted. */
export type IeltsResponseMap = Record<string, IeltsQuestionResponseValue>;
