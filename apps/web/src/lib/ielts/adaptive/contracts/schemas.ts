import { z } from "zod";
import {
  DEFAULT_IELTS_TARGET_BAND,
  IELTS_FEEDBACK_LANGUAGES,
  IELTS_ISO_WEEKDAYS,
  IELTS_LEARN_ACTIVITY_TYPES,
  IELTS_LEARN_ATOM_SCORING_MODES,
  IELTS_MODULES,
  IELTS_PLAN_ATOM_KINDS,
  IELTS_SKILLS,
} from "./types";
import type {
  IeltsBandEstimate,
  IeltsBandEvidence,
  IeltsBandPrediction,
  IeltsGoalModel,
  IeltsIsoWeekday,
  IeltsLearnAtom,
  IeltsPredictionSnapshot,
  IeltsRecommendedActivityFilters,
  IeltsSkillBandTargets,
  IeltsWeaknessSignal,
  IeltsWeeklyAvailability,
} from "./types";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isIsoDateTime(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function hasUniqueValues<T extends number | string>(values: T[]): boolean {
  return new Set(values).size === values.length;
}

export const IeltsSkillSchema = z.enum(IELTS_SKILLS);
export const IeltsModuleSchema = z.enum(IELTS_MODULES);
export const IeltsFeedbackLanguageSchema = z.enum(IELTS_FEEDBACK_LANGUAGES);
export const IeltsPredictionStatusSchema = z.enum([
  "diagnostic_needed",
  "low_confidence",
  "medium_confidence",
  "high_confidence",
]);
export const IeltsTrendDirectionSchema = z.enum(["up", "down", "flat", "unknown"]);
export const IeltsWeaknessSeveritySchema = z.enum(["watch", "weak", "critical"]);
export const IeltsLearnActivityTypeSchema = z.enum(IELTS_LEARN_ACTIVITY_TYPES);
export const IeltsPlanAtomKindSchema = z.enum(IELTS_PLAN_ATOM_KINDS);
export const IeltsLearnAtomScoringModeSchema = z.enum(
  IELTS_LEARN_ATOM_SCORING_MODES,
);

export const IeltsBandValueSchema = z
  .number()
  .min(0)
  .max(9)
  .refine((value) => Number.isInteger(value * 2), {
    message: "IELTS bands must use 0.5 increments",
  });

export const IeltsConfidenceSchema = z.number().min(0).max(1);
export const IeltsIsoDateSchema = z.string().regex(ISO_DATE_RE);
export const IeltsIsoDateTimeSchema = z.string().min(1).refine(isIsoDateTime, {
  message: "Expected an ISO-compatible date-time string",
});

export const IeltsBandEvidenceSchema: z.ZodType<IeltsBandEvidence> = z
  .object({
    source: z.enum([
      "full_mock",
      "skill_mock",
      "writing_task",
      "speaking_part",
      "objective_drill",
      "learn_activity",
      "debate_prior",
    ]),
    label: z.string().min(1),
    band: IeltsBandValueSchema.nullable(),
    rawScore: z.number().nullable(),
    weight: z.number().min(0).max(1),
    occurredAt: IeltsIsoDateTimeSchema,
    explanation: z.string().min(1),
  })
  .strict();

export const IeltsBandEstimateSchema: z.ZodType<IeltsBandEstimate> = z
  .object({
    band: IeltsBandValueSchema.nullable(),
    lower: IeltsBandValueSchema.nullable(),
    upper: IeltsBandValueSchema.nullable(),
    confidence: IeltsConfidenceSchema,
    status: IeltsPredictionStatusSchema,
    trend: z
      .object({
        direction: IeltsTrendDirectionSchema,
        delta30d: z.number().nullable(),
        evidencePoints: z.number().int().min(0),
        explanation: z.string().min(1),
      })
      .strict(),
    evidence: z.array(IeltsBandEvidenceSchema),
    explanation: z.array(z.string().min(1)),
  })
  .strict();

export const IeltsRecommendedActivityFiltersSchema: z.ZodType<
  IeltsRecommendedActivityFilters
> = z
  .object({
    skill: z.string().min(1),
    questionTypes: z.array(z.string().min(1)).optional(),
    criteria: z.array(z.string().min(1)).optional(),
    subskillTags: z.array(z.string().min(1)).optional(),
  })
  .strict();

export const IeltsWeaknessSignalSchema: z.ZodType<IeltsWeaknessSignal> = z
  .object({
    skill: IeltsSkillSchema,
    key: z.string().min(1),
    labelEn: z.string().min(1),
    labelVi: z.string().min(1),
    severity: IeltsWeaknessSeveritySchema,
    confidence: IeltsConfidenceSchema,
    evidenceCount: z.number().int().min(0),
    currentValue: IeltsBandValueSchema.nullable(),
    targetValue: IeltsBandValueSchema.nullable(),
    reasonEn: z.string().min(1),
    reasonVi: z.string().min(1),
    recommendedActivityFilters: IeltsRecommendedActivityFiltersSchema,
  })
  .strict();

const SkillBandRecordSchema = z
  .object({
    listening: IeltsBandValueSchema.nullable(),
    reading: IeltsBandValueSchema.nullable(),
    writing: IeltsBandValueSchema.nullable(),
    speaking: IeltsBandValueSchema.nullable(),
  })
  .strict();

export const IeltsBandPredictionSchema: z.ZodType<IeltsBandPrediction> = z
  .object({
    userId: z.string().uuid(),
    asOf: IeltsIsoDateTimeSchema,
    modelVersion: z.literal("weighted-recency-v1"),
    module: IeltsModuleSchema,
    overall: IeltsBandEstimateSchema,
    skills: z
      .object({
        listening: IeltsBandEstimateSchema,
        reading: IeltsBandEstimateSchema,
        writing: IeltsBandEstimateSchema,
        speaking: IeltsBandEstimateSchema,
      })
      .strict(),
    weaknesses: z.array(IeltsWeaknessSignalSchema),
    limitations: z.array(z.string().min(1)),
    nextBestDiagnostic: z
      .object({
        required: z.boolean(),
        skill: z.union([IeltsSkillSchema, z.literal("full_mock")]).nullable(),
        reasonEn: z.string().min(1),
        reasonVi: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const IeltsPredictionSnapshotSchema: z.ZodType<IeltsPredictionSnapshot> = z
  .object({
    snapshotId: z.string().uuid(),
    userId: z.string().uuid(),
    generatedAt: IeltsIsoDateTimeSchema,
    sourceAttemptIds: z.array(z.string().uuid()),
    modelVersion: z.string().min(1),
    module: IeltsModuleSchema,
    predictedOverallBand: IeltsBandValueSchema.nullable(),
    predictedSkillBands: SkillBandRecordSchema,
    confidence: IeltsConfidenceSchema,
    uncertaintyBandHalfSteps: z.number().int().min(0),
    weaknesses: z.array(IeltsWeaknessSignalSchema),
    strengths: z.array(IeltsWeaknessSignalSchema),
    reasoning: z
      .object({
        en: z.string().min(1),
        vi: z.string().min(1),
      })
      .strict(),
  })
  .strict();

export const IeltsLearnAtomSchema: z.ZodType<IeltsLearnAtom> = z
  .object({
    activityType: IeltsLearnActivityTypeSchema,
    skill: IeltsSkillSchema,
    focusArea: z.string().min(1),
    estimatedMinutes: z.number().int().min(1).max(240),
    questionIds: z.array(z.string().uuid()),
    reviewItemIds: z.array(z.string().uuid()).optional(),
    rendererTags: z.array(z.string().min(1)),
    scoringMode: IeltsLearnAtomScoringModeSchema,
  })
  .strict();

const IeltsIsoWeekdaySchema: z.ZodType<IeltsIsoWeekday> = z.union([
  z.literal(IELTS_ISO_WEEKDAYS[0]),
  z.literal(IELTS_ISO_WEEKDAYS[1]),
  z.literal(IELTS_ISO_WEEKDAYS[2]),
  z.literal(IELTS_ISO_WEEKDAYS[3]),
  z.literal(IELTS_ISO_WEEKDAYS[4]),
  z.literal(IELTS_ISO_WEEKDAYS[5]),
  z.literal(IELTS_ISO_WEEKDAYS[6]),
]);

export const IeltsWeeklyAvailabilitySchema: z.ZodType<IeltsWeeklyAvailability> = z
  .object({
    studyDays: z
      .array(IeltsIsoWeekdaySchema)
      .min(1)
      .max(7)
      .refine(hasUniqueValues, { message: "Study days must be unique" }),
    dailyMinutes: z.number().int().min(5).max(240),
    timezone: z.string().min(1).default("Asia/Ho_Chi_Minh"),
    preferredIntensity: z.enum(["light", "standard", "intensive"]).optional(),
  })
  .strict();

export const IeltsSkillBandTargetsSchema: z.ZodType<IeltsSkillBandTargets> = z
  .object({
    listening: IeltsBandValueSchema.nullish(),
    reading: IeltsBandValueSchema.nullish(),
    writing: IeltsBandValueSchema.nullish(),
    speaking: IeltsBandValueSchema.nullish(),
  })
  .partial()
  .strict();

export const IeltsGoalModelSchema: z.ZodType<IeltsGoalModel> = z
  .object({
    module: IeltsModuleSchema.default("academic"),
    targetOverallBand: IeltsBandValueSchema.default(DEFAULT_IELTS_TARGET_BAND),
    targetSkillBands: IeltsSkillBandTargetsSchema.default({}),
    targetTestDate: IeltsIsoDateSchema,
    focusSkills: z
      .array(IeltsSkillSchema)
      .min(1)
      .max(4)
      .refine(hasUniqueValues, { message: "Focus skills must be unique" })
      .optional(),
    availability: IeltsWeeklyAvailabilitySchema,
    feedbackLanguage: IeltsFeedbackLanguageSchema.default("en"),
  })
  .strict();
