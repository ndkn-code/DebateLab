import { z } from "zod";
import {
  IeltsLearnActivityTypeSchema,
  type IeltsLearnActivityType,
  type IeltsSkill,
} from "@/lib/ielts/adaptive/contracts";

export const IELTS_MICRO_DRAFT_PROMPT_VERSION = "ielts-micro-draft-v1";

export const IELTS_MICRO_DRAFT_ACTIVITY_TYPES = [
  "ielts_vocab_collocation",
  "ielts_paraphrase_transform",
  "ielts_gap_fill",
  "ielts_tfng_reasoning",
  "ielts_scan_detail",
  "ielts_sentence_transform",
  "ielts_cohesion_linker",
] as const satisfies readonly IeltsLearnActivityType[];

export type IeltsMicroDraftActivityType =
  (typeof IELTS_MICRO_DRAFT_ACTIVITY_TYPES)[number];

export const IeltsMicroDraftActivityTypeSchema = IeltsLearnActivityTypeSchema.refine(
  (value): value is IeltsMicroDraftActivityType =>
    IELTS_MICRO_DRAFT_ACTIVITY_TYPES.includes(
      value as IeltsMicroDraftActivityType,
    ),
  { message: "Unsupported IELTS micro-draft activity type" },
);

export const IeltsMicroDraftStatusSchema = z.enum([
  "draft",
  "needs_review",
  "approved",
  "rejected",
  "published",
]);
export type IeltsMicroDraftStatus = z.infer<typeof IeltsMicroDraftStatusSchema>;

const LocalizedTextSchema = z
  .object({
    en: z.string().min(1).max(1200),
    vi: z.string().min(1).max(1200),
  })
  .strict();

const ChoiceSchema = z
  .object({
    id: z.string().min(1).max(64),
    text: z.string().min(1).max(500),
  })
  .strict();

const BasePublicContentSchema = z
  .object({
    title: LocalizedTextSchema,
    instruction: LocalizedTextSchema,
    prompt: LocalizedTextSchema,
    sourceAttribution: LocalizedTextSchema,
    estimatedMinutes: z.number().int().min(1).max(15).default(4),
  })
  .strict();

export const VocabCollocationContentSchema = BasePublicContentSchema.extend({
  type: z.literal("ielts_vocab_collocation"),
  stem: LocalizedTextSchema,
  options: z.array(ChoiceSchema).min(2).max(5),
  focusLexeme: z.string().min(1).max(160),
}).strict();

export const ParaphraseTransformContentSchema = BasePublicContentSchema.extend({
  type: z.literal("ielts_paraphrase_transform"),
  sourceText: z.string().min(1).max(1200),
  targetMeaning: LocalizedTextSchema,
  options: z.array(ChoiceSchema).min(2).max(5),
}).strict();

export const GapFillContentSchema = BasePublicContentSchema.extend({
  type: z.literal("ielts_gap_fill"),
  textWithBlank: z.string().min(1).max(1600),
  blankLabel: z.string().min(1).max(80).default("1"),
  wordLimit: z.number().int().min(1).max(5).nullable().default(null),
}).strict();

export const TfngReasoningContentSchema = BasePublicContentSchema.extend({
  type: z.literal("ielts_tfng_reasoning"),
  statement: LocalizedTextSchema,
  options: z.array(ChoiceSchema).min(3).max(3),
  rationalePrompt: LocalizedTextSchema,
}).strict();

export const ScanDetailContentSchema = BasePublicContentSchema.extend({
  type: z.literal("ielts_scan_detail"),
  sourceText: z.string().min(1).max(1800),
  detailQuestion: LocalizedTextSchema,
  wordLimit: z.number().int().min(1).max(5).nullable().default(null),
}).strict();

export const SentenceTransformContentSchema = BasePublicContentSchema.extend({
  type: z.literal("ielts_sentence_transform"),
  sourceSentence: z.string().min(1).max(1200),
  targetMeaning: LocalizedTextSchema,
  textWithBlank: z.string().min(1).max(1600),
  wordLimit: z.number().int().min(1).max(8).nullable().default(null),
}).strict();

export const CohesionLinkerContentSchema = BasePublicContentSchema.extend({
  type: z.literal("ielts_cohesion_linker"),
  textWithBlank: z.string().min(1).max(1600),
  options: z.array(ChoiceSchema).min(2).max(5),
}).strict();

export const IeltsMicroDraftPublicContentSchema = z.discriminatedUnion("type", [
  VocabCollocationContentSchema,
  ParaphraseTransformContentSchema,
  GapFillContentSchema,
  TfngReasoningContentSchema,
  ScanDetailContentSchema,
  SentenceTransformContentSchema,
  CohesionLinkerContentSchema,
]);
export type IeltsMicroDraftPublicContent = z.infer<
  typeof IeltsMicroDraftPublicContentSchema
>;

const ObjectiveChoiceAnswerKeySchema = z
  .object({
    correctOptionId: z.string().min(1).max(64),
    explanationEn: z.string().min(1).max(1600),
    explanationVi: z.string().min(1).max(1600),
  })
  .strict();

export const VocabCollocationAnswerKeySchema =
  ObjectiveChoiceAnswerKeySchema.extend({
    type: z.literal("ielts_vocab_collocation"),
  }).strict();

export const ParaphraseTransformAnswerKeySchema =
  ObjectiveChoiceAnswerKeySchema.extend({
    type: z.literal("ielts_paraphrase_transform"),
  }).strict();

export const GapFillAnswerKeySchema = z
  .object({
    type: z.literal("ielts_gap_fill"),
    correctAnswers: z.array(z.string().min(1).max(200)).min(1).max(8),
    acceptVariants: z.array(z.string().min(1).max(200)).max(20).default([]),
    caseSensitive: z.boolean().default(false),
    explanationEn: z.string().min(1).max(1600),
    explanationVi: z.string().min(1).max(1600),
  })
  .strict();

export const TfngReasoningAnswerKeySchema =
  ObjectiveChoiceAnswerKeySchema.extend({
    type: z.literal("ielts_tfng_reasoning"),
  }).strict();

export const ScanDetailAnswerKeySchema = GapFillAnswerKeySchema.extend({
  type: z.literal("ielts_scan_detail"),
}).strict();

export const SentenceTransformAnswerKeySchema = GapFillAnswerKeySchema.extend({
  type: z.literal("ielts_sentence_transform"),
}).strict();

export const CohesionLinkerAnswerKeySchema =
  ObjectiveChoiceAnswerKeySchema.extend({
    type: z.literal("ielts_cohesion_linker"),
  }).strict();

export const IeltsMicroDraftAnswerKeySchema = z.discriminatedUnion("type", [
  VocabCollocationAnswerKeySchema,
  ParaphraseTransformAnswerKeySchema,
  GapFillAnswerKeySchema,
  TfngReasoningAnswerKeySchema,
  ScanDetailAnswerKeySchema,
  SentenceTransformAnswerKeySchema,
  CohesionLinkerAnswerKeySchema,
]);
export type IeltsMicroDraftAnswerKey = z.infer<
  typeof IeltsMicroDraftAnswerKeySchema
>;

export const GeneratedMicroDraftSchema = z
  .object({
    activityType: IeltsMicroDraftActivityTypeSchema,
    subskillKey: z.string().min(1).max(120).nullable().default(null),
    content: IeltsMicroDraftPublicContentSchema,
    answerKey: IeltsMicroDraftAnswerKeySchema,
    rationaleEn: z.string().min(1).max(1600),
    rationaleVi: z.string().min(1).max(1600),
    sourceTextQuote: z.string().min(1).max(1200),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.content.type !== value.activityType) {
      ctx.addIssue({
        code: "custom",
        message: "content.type must match activityType",
        path: ["content", "type"],
      });
    }
    if (value.answerKey.type !== value.activityType) {
      ctx.addIssue({
        code: "custom",
        message: "answerKey.type must match activityType",
        path: ["answerKey", "type"],
      });
    }
  });

export const GeneratedMicroDraftsSchema = z
  .object({
    drafts: z.array(GeneratedMicroDraftSchema).min(1).max(3),
  })
  .strict();

export type GeneratedMicroDraft = z.infer<typeof GeneratedMicroDraftSchema>;

export const UpdateMicroItemDraftSchema = z
  .object({
    draftId: z.string().uuid(),
    content: IeltsMicroDraftPublicContentSchema.optional(),
    answerKey: IeltsMicroDraftAnswerKeySchema.optional(),
    rationaleEn: z.string().min(1).max(1600).optional(),
    rationaleVi: z.string().min(1).max(1600).optional(),
    subskillKey: z.string().min(1).max(120).nullable().optional(),
    qaNotes: z.string().max(3000).nullable().optional(),
  })
  .strict();

export const ReviewMicroItemDraftSchema = z
  .object({
    draftId: z.string().uuid(),
    status: z.enum(["needs_review", "approved", "rejected"]),
    qaNotes: z.string().max(3000).nullable().optional(),
  })
  .strict();

export const GenerateMicroItemDraftsSchema = z
  .object({
    questionId: z.string().uuid(),
  })
  .strict();

export const PublishMicroItemDraftSchema = z
  .object({
    draftId: z.string().uuid(),
    moduleId: z.string().uuid(),
    title: z.string().min(1).max(180).optional(),
  })
  .strict();

export interface MicroDraftSubskillOption {
  key: string;
  skill: IeltsSkill;
  labelEn: string;
  labelVi: string;
  kind: string;
  questionType: string | null;
  tags: string[];
}

const FORBIDDEN_CONTENT_KEYS = new Set([
  "answer",
  "answers",
  "answer_key",
  "answerkey",
  "correct",
  "correct_answer",
  "correctanswer",
  "correct_option_id",
  "correctoptionid",
  "accept_variants",
  "acceptvariants",
  "accepted_answers",
  "acceptedanswers",
]);

export function findAnswerKeyLeakPath(value: unknown, path = "content"): string | null {
  if (!value || typeof value !== "object") return null;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const leak = findAnswerKeyLeakPath(value[index], `${path}[${index}]`);
      if (leak) return leak;
    }
    return null;
  }

  for (const [key, child] of Object.entries(value)) {
    const normalized = key.replace(/[\s-]/g, "_").toLowerCase();
    if (FORBIDDEN_CONTENT_KEYS.has(normalized)) {
      return `${path}.${key}`;
    }
    const leak = findAnswerKeyLeakPath(child, `${path}.${key}`);
    if (leak) return leak;
  }
  return null;
}

export function assertNoAnswerKeyLeak(content: unknown): void {
  const leakPath = findAnswerKeyLeakPath(content);
  if (leakPath) {
    throw new Error(`Learner-visible draft content contains answer-key data at ${leakPath}`);
  }
}

export function assertContentMatchesAnswerKey(
  content: IeltsMicroDraftPublicContent,
  answerKey: IeltsMicroDraftAnswerKey,
): void {
  assertNoAnswerKeyLeak(content);
  if (content.type !== answerKey.type) {
    throw new Error("Draft content and answer key activity types do not match");
  }

  if ("correctOptionId" in answerKey) {
    const optionIds = new Set(
      "options" in content ? content.options.map((option) => option.id) : [],
    );
    if (!optionIds.has(answerKey.correctOptionId)) {
      throw new Error("Answer key points at an option that is not in public content");
    }
  }
}
