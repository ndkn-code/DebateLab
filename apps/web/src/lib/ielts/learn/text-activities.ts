import { z } from "zod";
import type {
  IeltsLearnActivityType,
  IeltsLearnAtom,
  IeltsModule,
} from "@/lib/ielts/adaptive/contracts";
import {
  IeltsLearnActivityTypeSchema,
  IeltsModuleSchema,
} from "@/lib/ielts/adaptive/contracts";
import { IeltsSubskillKeySchema } from "@/lib/ielts/adaptive/evidence";
import type { ActivityResponses, ScoreResult, ValidationResult } from "@/lib/activity/registry";

export const IELTS_FIRST_TEXT_ACTIVITY_TYPES = [
  "ielts_vocab_collocation",
  "ielts_paraphrase_transform",
  "ielts_gap_fill",
  "ielts_tfng_reasoning",
  "ielts_scan_detail",
  "ielts_sentence_transform",
  "ielts_cohesion_linker",
] as const satisfies readonly IeltsLearnActivityType[];

export type IeltsFirstTextActivityType =
  (typeof IELTS_FIRST_TEXT_ACTIVITY_TYPES)[number];

export const IeltsFirstTextActivityTypeSchema = z
  .enum(IELTS_FIRST_TEXT_ACTIVITY_TYPES)
  .refine((type) => IeltsLearnActivityTypeSchema.safeParse(type).success);

const BilingualTextSchema = z
  .object({
    en: z.string().min(1).max(1000),
    vi: z.string().min(1).max(1000),
  })
  .strict();

export const IeltsTextActivitySourceSchema = z
  .object({
    questionId: z.string().uuid(),
    subskillKey: IeltsSubskillKeySchema,
    labelEn: z.string().min(1).max(200).optional(),
    labelVi: z.string().min(1).max(200).optional(),
  })
  .strict();

const BaseIeltsTextActivityContentSchema = z
  .object({
    activityType: IeltsFirstTextActivityTypeSchema,
    version: z.literal(1).default(1),
    module: IeltsModuleSchema.default("academic"),
    instruction: BilingualTextSchema,
    sources: z.array(IeltsTextActivitySourceSchema).min(1).max(8),
    rendererTags: z.array(z.string().min(1).max(80)).max(12).default([]),
  })
  .strict();

export const IeltsVocabCollocationActivityContentSchema =
  BaseIeltsTextActivityContentSchema.extend({
    activityType: z.literal("ielts_vocab_collocation"),
    vocabSource: z
      .object({
        bandTag: z.string().trim().min(1).max(20).optional(),
        topicTag: z.string().trim().min(1).max(100).optional(),
        limit: z.number().int().min(1).max(20).default(6),
      })
      .strict()
      .optional(),
  }).strict();

export const IeltsParaphraseTransformActivityContentSchema =
  BaseIeltsTextActivityContentSchema.extend({
    activityType: z.literal("ielts_paraphrase_transform"),
  }).strict();

export const IeltsGapFillActivityContentSchema =
  BaseIeltsTextActivityContentSchema.extend({
    activityType: z.literal("ielts_gap_fill"),
  }).strict();

export const IeltsTfngReasoningActivityContentSchema =
  BaseIeltsTextActivityContentSchema.extend({
    activityType: z.literal("ielts_tfng_reasoning"),
    rationalePrompt: BilingualTextSchema.default({
      en: "Write one short reason from the passage for your choice.",
      vi: "Viết một lý do ngắn từ bài đọc cho lựa chọn của bạn.",
    }),
  }).strict();

export const IeltsScanDetailActivityContentSchema =
  BaseIeltsTextActivityContentSchema.extend({
    activityType: z.literal("ielts_scan_detail"),
  }).strict();

export const IeltsSentenceTransformActivityContentSchema =
  BaseIeltsTextActivityContentSchema.extend({
    activityType: z.literal("ielts_sentence_transform"),
  }).strict();

export const IeltsCohesionLinkerActivityContentSchema =
  BaseIeltsTextActivityContentSchema.extend({
    activityType: z.literal("ielts_cohesion_linker"),
  }).strict();

export const IeltsTextActivityContentSchema = z
  .discriminatedUnion("activityType", [
    IeltsVocabCollocationActivityContentSchema,
    IeltsParaphraseTransformActivityContentSchema,
    IeltsGapFillActivityContentSchema,
    IeltsTfngReasoningActivityContentSchema,
    IeltsScanDetailActivityContentSchema,
    IeltsSentenceTransformActivityContentSchema,
    IeltsCohesionLinkerActivityContentSchema,
  ])
  .superRefine((content, ctx) => {
    if (!canUseMultipleSources(content.activityType) && content.sources.length !== 1) {
      ctx.addIssue({
        code: "custom",
        path: ["sources"],
        message: `${content.activityType} expects exactly one source question`,
      });
    }
  });

export type IeltsTextActivityContent = z.infer<
  typeof IeltsTextActivityContentSchema
>;
export type IeltsTextActivitySource = z.infer<
  typeof IeltsTextActivitySourceSchema
>;

export type SubmittedIeltsTextAnswer = {
  questionId: string;
  value: string;
};

export type IeltsTextActivityFeedbackItem = {
  questionId: string;
  correct: boolean;
  awardedPoints: number;
  maxPoints: number;
  feedbackEn: string;
  feedbackVi: string;
};

export type IeltsTextActivityFeedback = {
  en: string;
  vi: string;
  items: IeltsTextActivityFeedbackItem[];
};

export type IeltsTextActivityQuestionView = {
  questionId: string;
  skill: string;
  questionType: string;
  prompt: string;
  groupInstructions: string | null;
  options: Array<{ value: string; label: string }>;
  wordLimit: number | null;
  correctAnswer?: string;
};

export type IeltsTextActivityView = {
  activityType: IeltsFirstTextActivityType;
  module: IeltsTextActivityContent["module"];
  instruction: IeltsTextActivityContent["instruction"];
  rationalePrompt?: Extract<
    IeltsTextActivityContent,
    { activityType: "ielts_tfng_reasoning" }
  >["rationalePrompt"];
  questions: IeltsTextActivityQuestionView[];
};

export function validateIeltsTextActivityContent(content: unknown): ValidationResult {
  const parsed = IeltsTextActivityContentSchema.safeParse(content);
  if (parsed.success) return { valid: true, errors: [] };
  return {
    valid: false,
    errors: parsed.error.issues.map((issue) => {
      const path = issue.path.join(".");
      return path ? `${path}: ${issue.message}` : issue.message;
    }),
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function primitiveToString(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return null;
}

function answerArray(responses: ActivityResponses): SubmittedIeltsTextAnswer[] {
  const answers = Array.isArray(responses.answers) ? responses.answers : [];
  return answers.flatMap((answer) => {
    const record = asRecord(answer);
    const questionId = primitiveToString(record.questionId);
    const value = primitiveToString(record.value);
    return questionId && value !== null ? [{ questionId, value }] : [];
  });
}

export function getIeltsTextResponseForQuestion(
  responses: ActivityResponses,
  questionId: string,
): unknown {
  const fromList = answerArray(responses).find(
    (answer) => answer.questionId === questionId,
  );
  if (fromList) return { value: fromList.value };

  const byQuestion = asRecord(responses.answersByQuestionId);
  const direct = byQuestion[questionId];
  if (direct !== undefined) return direct;

  for (const key of ["value", "answer", "selectedOptionId", "selected"]) {
    const value = primitiveToString(responses[key]);
    if (value !== null) return { value };
  }
  return { value: "" };
}

export function isIeltsFirstTextActivityType(
  type: string,
): type is IeltsFirstTextActivityType {
  return IELTS_FIRST_TEXT_ACTIVITY_TYPES.includes(
    type as IeltsFirstTextActivityType,
  );
}

export function canUseMultipleSources(
  activityType: IeltsFirstTextActivityType,
): boolean {
  return (
    activityType === "ielts_gap_fill" ||
    activityType === "ielts_scan_detail" ||
    activityType === "ielts_cohesion_linker"
  );
}

export function isIeltsTextChoiceActivity(
  activityType: IeltsFirstTextActivityType,
): boolean {
  return (
    activityType === "ielts_vocab_collocation" ||
    activityType === "ielts_paraphrase_transform" ||
    activityType === "ielts_tfng_reasoning"
  );
}

export function ieltsTextActivityEstimatedMinutes(
  activityType: IeltsFirstTextActivityType,
): number {
  if (activityType === "ielts_gap_fill") return 6;
  if (activityType === "ielts_scan_detail") return 5;
  if (activityType === "ielts_cohesion_linker") return 5;
  return 4;
}

export function defaultIeltsTextActivitySubskill(
  activityType: IeltsFirstTextActivityType,
): IeltsTextActivitySource["subskillKey"] {
  const defaults: Record<IeltsFirstTextActivityType, IeltsTextActivitySource["subskillKey"]> = {
    ielts_vocab_collocation: "writing:collocation_precision",
    ielts_paraphrase_transform: "reading:paraphrase_recognition",
    ielts_gap_fill: "reading:sentence_completion",
    ielts_tfng_reasoning: "reading:true_false_notgiven",
    ielts_scan_detail: "reading:scan_specific_detail",
    ielts_sentence_transform: "writing:paraphrase_transform",
    ielts_cohesion_linker: "writing:coherence_cohesion",
  };
  return defaults[activityType];
}

export function scoreIeltsTextActivityPreview(
  content: unknown,
): ScoreResult {
  const parsed = IeltsTextActivityContentSchema.safeParse(content);
  if (!parsed.success) return { score: 0, maxScore: 0 };
  return { score: 0, maxScore: parsed.data.sources.length };
}

export function toIeltsLearnAtom(content: IeltsTextActivityContent): IeltsLearnAtom {
  const firstSubskill = content.sources[0]?.subskillKey ?? "reading:unknown";
  const skill = firstSubskill.split(":")[0] as IeltsLearnAtom["skill"];
  return {
    activityType: content.activityType,
    skill,
    focusArea: content.sources[0]?.labelEn ?? firstSubskill,
    estimatedMinutes: ieltsTextActivityEstimatedMinutes(content.activityType),
    questionIds: content.sources.map((source) => source.questionId),
    rendererTags: content.rendererTags,
    scoringMode: "objective",
  };
}

export function defaultIeltsTextActivityContent(
  activityType: IeltsFirstTextActivityType,
  module: IeltsModule = "academic",
): IeltsTextActivityContent {
  return IeltsTextActivityContentSchema.parse({
    activityType,
    version: 1,
    module,
    instruction: {
      en: "Choose the best IELTS answer.",
      vi: "Chọn đáp án IELTS phù hợp nhất.",
    },
    sources: [
      {
        questionId: "00000000-0000-4000-8000-000000000201",
        subskillKey: defaultIeltsTextActivitySubskill(activityType),
      },
    ],
    rendererTags: [activityType],
  });
}
