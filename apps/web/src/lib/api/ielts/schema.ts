/**
 * IELTS data-model boundary schemas (WS-0.3).
 *
 * Pure module: Zod schemas + payload mappers, no Supabase import at runtime
 * (the generated row types are `import type` only, erased at runtime). This is
 * what the smoke test exercises without a database. The actual DB calls live in
 * the sibling repository modules and use the typed client factories.
 *
 * The enum tuples below are the single source of truth for boundary validation
 * and mirror the native PG enums created in
 * supabase/migrations/20260618205215_ielts_data_model.sql (and, post-regen,
 * Constants.public.Enums.*). See docs/ielts/data-access.md §9 on enum evolution.
 */
import { z } from "zod";
import type { TablesInsert, TablesUpdate } from "@/types/supabase";

export const IELTS_SKILLS = ["listening", "reading", "writing", "speaking"] as const;
export const IELTS_MODULES = ["academic", "general_training"] as const;
export const IELTS_TEST_KINDS = ["full_mock", "skill_set", "drill"] as const;
export const IELTS_CONTENT_STATUSES = [
  "draft",
  "in_qa",
  "approved",
  "published",
  "archived",
] as const;
export const IELTS_ACCENTS = ["uk", "us", "aus", "other"] as const;

/**
 * The complete IELTS question-type taxonomy (mirrors the `ielts_question_type`
 * native enum). `ielts_questions` is the canonical bank — see
 * docs/ielts/data-access.md §8.
 */
export const IELTS_QUESTION_TYPES = [
  "mcq_single",
  "mcq_multi",
  "true_false_notgiven",
  "yes_no_notgiven",
  "matching_headings",
  "matching_information",
  "matching_features",
  "sentence_completion",
  "summary_completion",
  "note_table_form_flowchart_completion",
  "short_answer",
  "diagram_label",
  "map_plan_label",
  "writing_task1_academic",
  "writing_task1_general",
  "writing_task2_essay",
  "speaking_part1",
  "speaking_part2_cuecard",
  "speaking_part3",
] as const;
export const IELTS_QUESTION_TYPE_COUNT = IELTS_QUESTION_TYPES.length;

/** Create-input for an `ielts_tests` row (the canonical container entity). */
export const CreateIeltsTestSchema = z
  .object({
    slug: z
      .string()
      .min(1)
      .max(120)
      .regex(/^[a-z0-9-]+$/, "slug must be kebab-case (a-z, 0-9, -)"),
    title: z.string().min(1).max(200),
    kind: z.enum(IELTS_TEST_KINDS).default("full_mock"),
    module: z.enum(IELTS_MODULES).default("academic"),
    skill: z.enum(IELTS_SKILLS).nullish(),
    status: z.enum(IELTS_CONTENT_STATUSES).default("draft"),
    timeLimitSeconds: z.number().int().positive().nullish(),
    description: z.string().max(2000).nullish(),
  })
  // Mirrors the DB CHECK (kind <> 'full_mock' or skill is null).
  .refine((v) => v.kind !== "full_mock" || v.skill == null, {
    message: "full_mock tests must not set a skill",
    path: ["skill"],
  });

export type CreateIeltsTestInput = z.infer<typeof CreateIeltsTestSchema>;

/** Map validated input to the typed `ielts_tests` insert row. */
export function toIeltsTestInsert(
  input: CreateIeltsTestInput,
): TablesInsert<"ielts_tests"> {
  return {
    slug: input.slug,
    title: input.title,
    kind: input.kind,
    module: input.module,
    skill: input.skill ?? null,
    status: input.status,
    time_limit_seconds: input.timeLimitSeconds ?? null,
    description: input.description ?? null,
  };
}

/**
 * Update-input for an `ielts_tests` row. Status + version are NOT editable here —
 * they move through the dedicated workflow (see workflow.ts / the publish action).
 * slug is immutable once created (it's referenced by import + URLs).
 */
export const UpdateIeltsTestSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    kind: z.enum(IELTS_TEST_KINDS).optional(),
    module: z.enum(IELTS_MODULES).optional(),
    skill: z.enum(IELTS_SKILLS).nullish(),
    timeLimitSeconds: z.number().int().positive().nullish(),
    description: z.string().max(2000).nullish(),
  })
  .refine((v) => v.kind !== "full_mock" || v.skill == null, {
    message: "full_mock tests must not set a skill",
    path: ["skill"],
  });

export type UpdateIeltsTestInput = z.infer<typeof UpdateIeltsTestSchema>;

/** Map a validated update to a typed `ielts_tests` patch (omits untouched keys). */
export function toIeltsTestUpdate(
  input: UpdateIeltsTestInput,
): TablesUpdate<"ielts_tests"> {
  const patch: TablesUpdate<"ielts_tests"> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.kind !== undefined) patch.kind = input.kind;
  if (input.module !== undefined) patch.module = input.module;
  if (input.skill !== undefined) patch.skill = input.skill ?? null;
  if (input.timeLimitSeconds !== undefined) {
    patch.time_limit_seconds = input.timeLimitSeconds ?? null;
  }
  if (input.description !== undefined) patch.description = input.description ?? null;
  return patch;
}

export const IELTS_FEEDBACK_LANGUAGES = ["en", "vi"] as const;
export type IeltsFeedbackLanguage = (typeof IELTS_FEEDBACK_LANGUAGES)[number];

/** The writing task types in the question taxonomy (one essay per task). */
export const IELTS_WRITING_QUESTION_TYPES = [
  "writing_task1_academic",
  "writing_task1_general",
  "writing_task2_essay",
] as const;

/** Task number a writing question type maps to (Task 2 counts double). */
export function writingTaskNumberForQuestionType(
  questionType: string,
): 1 | 2 {
  return questionType === "writing_task2_essay" ? 2 : 1;
}

/** IELTS counts words as whitespace-separated tokens. */
export function countEssayWords(essay: string): number {
  return essay.trim().split(/\s+/).filter(Boolean).length;
}

/** Create-input for a learner's Writing submission (WS-3.1). */
export const CreateWritingResponseSchema = z.object({
  attemptId: z.string().uuid(),
  questionId: z.string().uuid(),
  essay: z.string().min(1).max(20_000),
  feedbackLanguage: z.enum(IELTS_FEEDBACK_LANGUAGES).default("en"),
});
export type CreateWritingResponseInput = z.infer<
  typeof CreateWritingResponseSchema
>;

/** Map a validated Writing submission to the typed `writing_responses` insert. */
export function toWritingResponseInsert(params: {
  input: CreateWritingResponseInput;
  userId: string;
  taskNumber: 1 | 2;
}): TablesInsert<"writing_responses"> {
  return {
    attempt_id: params.input.attemptId,
    question_id: params.input.questionId,
    user_id: params.userId,
    task_number: params.taskNumber,
    essay: params.input.essay,
    word_count: countEssayWords(params.input.essay),
    feedback_language: params.input.feedbackLanguage,
    status: "pending",
    // A (re)submission clears any prior AI score so the response re-scores clean.
    task_response_band: null,
    coherence_cohesion_band: null,
    lexical_resource_band: null,
    grammar_band: null,
    task_band: null,
    inline_corrections: [],
    paragraph_feedback: [],
    model_answer: null,
    scored_at: null,
  };
}
