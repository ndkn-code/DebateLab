/**
 * Boundary schemas + mappers for the timed mock engine (WS-2.1). Pure module
 * (Zod + type-only row imports): the single validated entry shape for every
 * mock server action, and the row → non-secret `IeltsQuestionView` mapper the
 * player consumes. No Supabase calls here — those live in the repositories.
 */
import { z } from "zod";
import type { Tables } from "@/types/supabase";
import type { IeltsQuestionView } from "@/lib/ielts/question-contract";
import { parseQuestionView } from "@/lib/ielts/question-types";

export const StartMockAttemptSchema = z.object({
  testId: z.string().uuid(),
});
export type StartMockAttemptInput = z.infer<typeof StartMockAttemptSchema>;

export const SectionActionSchema = z.object({
  attemptId: z.string().uuid(),
  sectionId: z.string().uuid(),
});
export type SectionActionInput = z.infer<typeof SectionActionSchema>;

// Response envelopes are variform (per question type); cap the serialized size
// so a forged client can't push an unbounded blob through the RPC.
const MAX_RESPONSE_BYTES = 16 * 1024;
export const SaveResponseSchema = z.object({
  sectionId: z.string().uuid(),
  questionId: z.string().uuid(),
  response: z
    .unknown()
    .refine(
      (value) => JSON.stringify(value ?? null).length <= MAX_RESPONSE_BYTES,
      "response payload too large",
    ),
});
export type SaveResponseInput = z.infer<typeof SaveResponseSchema>;

export const SubmitAttemptSchema = z.object({
  attemptId: z.string().uuid(),
});
export type SubmitAttemptInput = z.infer<typeof SubmitAttemptSchema>;

/** The `ielts_questions` columns the player needs (all non-secret). */
export type QuestionRow = Pick<
  Tables<"ielts_questions">,
  | "id"
  | "skill"
  | "question_type"
  | "order_index"
  | "group_key"
  | "group_instructions"
  | "prompt"
  | "options"
  | "max_points"
  | "word_limit"
  | "visual"
  | "metadata"
  | "passage_id"
  | "listening_section_id"
>;

/** Map an `ielts_questions` row to the non-secret learner-facing view. */
export function toQuestionView(row: QuestionRow): IeltsQuestionView {
  const view = parseQuestionView({
    id: row.id,
    question_type: row.question_type,
    skill: row.skill,
    prompt: row.prompt,
    group_instructions: row.group_instructions,
    word_limit: row.word_limit,
    max_points: row.max_points,
    options: row.options,
    visual: row.visual,
    metadata: row.metadata,
  });

  return {
    ...view,
    orderIndex: row.order_index,
    groupKey: row.group_key,
    passageId: row.passage_id,
    listeningSectionId: row.listening_section_id,
  };
}
