/**
 * Canonical create/update boundary schema for an IELTS question + its SECRET key
 * (WS-1.1). One schema, type-aware: it normalizes loose authoring input (pipe
 * lists, TRUE/T/NG tokens) and validates per-question-type invariants, then maps
 * to the typed `create_ielts_question_with_key` / `update_*` RPC arguments. The
 * RPC writes `ielts_questions` + `ielts_question_keys` atomically (data-access §8).
 */
import { z } from "zod";
import type { Database, Json } from "@/types/supabase";
import { IELTS_QUESTION_TYPES, IELTS_SKILLS } from "./schema";
import { JsonSchema } from "./json";
import { VisualSchema, type IeltsVisual } from "./visual";
import {
  dedupeStrings,
  normalizeTfngToken,
  normalizeWhitespace,
  normalizeYnngToken,
  splitPipeList,
} from "./normalize";

export type IeltsQuestionType = (typeof IELTS_QUESTION_TYPES)[number];
export type IeltsSkill = (typeof IELTS_SKILLS)[number];

const WRITING_TYPES = new Set<IeltsQuestionType>([
  "writing_task1_academic",
  "writing_task1_general",
  "writing_task2_essay",
]);
const SPEAKING_TYPES = new Set<IeltsQuestionType>([
  "speaking_part1",
  "speaking_part2_cuecard",
  "speaking_part3",
]);
const MCQ_TYPES = new Set<IeltsQuestionType>(["mcq_single", "mcq_multi"]);

export type QuestionCategory = "writing" | "speaking" | "objective";

/** Which scoring family a question type belongs to. */
export function questionCategory(type: IeltsQuestionType): QuestionCategory {
  if (WRITING_TYPES.has(type)) return "writing";
  if (SPEAKING_TYPES.has(type)) return "speaking";
  return "objective";
}

type Add = (path: string, message: string) => void;

const StringOrList = z.union([z.string(), z.array(z.string())]);

const BaseQuestion = z.object({
  testId: z.string().uuid(),
  skill: z.enum(IELTS_SKILLS),
  questionType: z.enum(IELTS_QUESTION_TYPES),
  prompt: z.string().min(1).max(8000),
  passageId: z.string().uuid().nullish(),
  listeningSectionId: z.string().uuid().nullish(),
  orderIndex: z.number().int().min(0).max(400).default(0),
  groupKey: z.string().max(120).nullish(),
  groupInstructions: z.string().max(2000).nullish(),
  options: StringOrList.optional(),
  maxPoints: z.number().int().min(0).max(40).default(1),
  wordLimit: z.number().int().positive().max(100).nullish(),
  visual: VisualSchema.nullish(),
  metadata: z.record(z.string(), JsonSchema).default({}),
  correctAnswer: StringOrList.optional(),
  acceptVariants: StringOrList.optional(),
  explanationEn: z.string().max(8000).nullish(),
  explanationVi: z.string().max(8000).nullish(),
  modelAnswer: z.string().max(20000).nullish(),
  examinerNotes: z.record(z.string(), z.string()).default({}),
});

type BaseQuestionInput = z.infer<typeof BaseQuestion>;

export interface NormalizedQuestionInput {
  testId: string;
  skill: IeltsSkill;
  questionType: IeltsQuestionType;
  prompt: string;
  passageId: string | null;
  listeningSectionId: string | null;
  orderIndex: number;
  groupKey: string | null;
  groupInstructions: string | null;
  options: string[];
  maxPoints: number;
  wordLimit: number | null;
  visual: IeltsVisual | null;
  metadata: Record<string, Json>;
  correctAnswer: Json;
  acceptVariants: string[];
  explanationEn: string | null;
  explanationVi: string | null;
  modelAnswer: string | null;
  examinerNotes: Record<string, string>;
}

export type NormalizedQuestionUpdate = NormalizedQuestionInput & {
  questionId: string;
};

function toStringArray(value: string | string[] | undefined): string[] {
  if (value == null) return [];
  return Array.isArray(value) ? dedupeStrings(value) : splitPipeList(value);
}

function validateConsistency(v: BaseQuestionInput, add: Add): void {
  const category = questionCategory(v.questionType);
  if (category === "writing" && v.skill !== "writing") {
    add("skill", "writing question types require skill = writing");
  }
  if (category === "speaking" && v.skill !== "speaking") {
    add("skill", "speaking question types require skill = speaking");
  }
  if (category === "objective" && v.skill !== "reading" && v.skill !== "listening") {
    add("skill", "objective question types require skill = reading or listening");
  }
  if (v.passageId && v.listeningSectionId) {
    add("passageId", "a question cannot link both a passage and a listening section");
  }
  if (v.skill === "reading" && v.listeningSectionId) {
    add("listeningSectionId", "a reading question cannot link a listening section");
  }
  if (v.skill === "listening" && v.passageId) {
    add("passageId", "a listening question cannot link a passage");
  }
}

function validateOptions(type: IeltsQuestionType, options: string[], add: Add): void {
  if (MCQ_TYPES.has(type) && options.length < 2) {
    add("options", `${type} requires at least 2 options`);
  }
}

function requireToken(
  token: string | null,
  fallback: string,
  label: string,
  add: Add,
): string {
  if (token) return token;
  add("correctAnswer", `answer must be one of ${label}`);
  return fallback;
}

function normalizeCorrectAnswer(
  type: IeltsQuestionType,
  raw: string | string[] | undefined,
  add: Add,
): Json {
  if (questionCategory(type) !== "objective") return {};
  if (type === "mcq_multi") {
    const arr = toStringArray(raw);
    if (arr.length === 0) add("correctAnswer", "mcq_multi needs at least one correct option");
    return arr;
  }
  const single = Array.isArray(raw)
    ? normalizeWhitespace(raw[0] ?? "")
    : normalizeWhitespace(raw ?? "");
  if (type === "true_false_notgiven") {
    return requireToken(normalizeTfngToken(single), single, "TRUE / FALSE / NOT GIVEN", add);
  }
  if (type === "yes_no_notgiven") {
    return requireToken(normalizeYnngToken(single), single, "YES / NO / NOT GIVEN", add);
  }
  if (single.length === 0) add("correctAnswer", `${type} requires a correct answer`);
  return single;
}

function trimToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeQuestion(
  v: BaseQuestionInput,
  ctx: z.RefinementCtx,
): NormalizedQuestionInput | null {
  const problems: Array<[string, string]> = [];
  const add: Add = (path, message) => problems.push([path, message]);

  validateConsistency(v, add);
  const options = toStringArray(v.options);
  validateOptions(v.questionType, options, add);
  const correctAnswer = normalizeCorrectAnswer(v.questionType, v.correctAnswer, add);
  const prompt = v.prompt.trim();
  if (prompt.length === 0) add("prompt", "prompt is required");

  for (const [path, message] of problems) {
    ctx.addIssue({ code: "custom", message, path: [path] });
  }
  if (problems.length > 0) return null;

  return {
    testId: v.testId,
    skill: v.skill,
    questionType: v.questionType,
    prompt,
    passageId: v.passageId ?? null,
    listeningSectionId: v.listeningSectionId ?? null,
    orderIndex: v.orderIndex,
    groupKey: trimToNull(v.groupKey),
    groupInstructions: trimToNull(v.groupInstructions),
    options,
    maxPoints: v.maxPoints,
    wordLimit: v.wordLimit ?? null,
    visual: v.visual ?? null,
    metadata: v.metadata,
    correctAnswer,
    acceptVariants: toStringArray(v.acceptVariants),
    explanationEn: trimToNull(v.explanationEn),
    explanationVi: trimToNull(v.explanationVi),
    modelAnswer: trimToNull(v.modelAnswer),
    examinerNotes: v.examinerNotes,
  };
}

export const CreateIeltsQuestionSchema = BaseQuestion.transform((v, ctx) => {
  const normalized = normalizeQuestion(v, ctx);
  return normalized ?? z.NEVER;
});

export const UpdateIeltsQuestionSchema = BaseQuestion.extend({
  questionId: z.string().uuid(),
}).transform((v, ctx) => {
  const normalized = normalizeQuestion(v, ctx);
  if (!normalized) return z.NEVER;
  return { ...normalized, questionId: v.questionId };
});

type CreateArgs = Database["public"]["Functions"]["create_ielts_question_with_key"]["Args"];
type UpdateArgs = Database["public"]["Functions"]["update_ielts_question_with_key"]["Args"];

function sharedArgs(input: NormalizedQuestionInput) {
  return {
    p_skill: input.skill,
    p_question_type: input.questionType,
    p_prompt: input.prompt,
    p_passage_id: input.passageId ?? undefined,
    p_listening_section_id: input.listeningSectionId ?? undefined,
    p_order_index: input.orderIndex,
    p_group_key: input.groupKey ?? undefined,
    p_group_instructions: input.groupInstructions ?? undefined,
    p_options: input.options as Json,
    p_max_points: input.maxPoints,
    p_word_limit: input.wordLimit ?? undefined,
    p_visual: (input.visual ?? undefined) as Json | undefined,
    p_metadata: input.metadata as Json,
    p_correct_answer: input.correctAnswer,
    p_accept_variants: input.acceptVariants as Json,
    p_explanation_en: input.explanationEn ?? undefined,
    p_explanation_vi: input.explanationVi ?? undefined,
    p_model_answer: input.modelAnswer ?? undefined,
    p_examiner_notes: input.examinerNotes as Json,
  };
}

/** Map a validated create input to typed RPC args. */
export function toCreateQuestionArgs(input: NormalizedQuestionInput): CreateArgs {
  return { p_test_id: input.testId, ...sharedArgs(input) };
}

/** Map a validated update input to typed RPC args. */
export function toUpdateQuestionArgs(input: NormalizedQuestionUpdate): UpdateArgs {
  return { p_question_id: input.questionId, ...sharedArgs(input) };
}
