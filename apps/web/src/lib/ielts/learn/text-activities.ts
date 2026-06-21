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

export const IeltsTextActivityContentSchema = z
  .object({
    activityType: IeltsFirstTextActivityTypeSchema,
    version: z.literal(1).default(1),
    module: IeltsModuleSchema.default("academic"),
    instruction: BilingualTextSchema,
    sources: z.array(IeltsTextActivitySourceSchema).min(1).max(8),
    rendererTags: z.array(z.string().min(1).max(80)).max(12).default([]),
  })
  .strict()
  .superRefine((content, ctx) => {
    if (
      content.activityType !== "ielts_gap_fill" &&
      content.sources.length !== 1
    ) {
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
};

export type IeltsTextActivityView = {
  activityType: IeltsFirstTextActivityType;
  module: IeltsTextActivityContent["module"];
  instruction: IeltsTextActivityContent["instruction"];
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
    estimatedMinutes: content.activityType === "ielts_gap_fill" ? 6 : 4,
    questionIds: content.sources.map((source) => source.questionId),
    rendererTags: content.rendererTags,
    scoringMode: "objective",
  };
}

export function defaultIeltsTextActivityContent(
  activityType: IeltsFirstTextActivityType,
  module: IeltsModule = "academic",
): IeltsTextActivityContent {
  return {
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
        subskillKey: "reading:paraphrase_recognition",
      },
    ],
    rendererTags: [activityType],
  };
}
