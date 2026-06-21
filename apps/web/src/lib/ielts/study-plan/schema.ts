import { z } from "zod";
import {
  IeltsBandPredictionSchema,
  IeltsGoalModelSchema,
  IeltsIsoDateSchema,
  IeltsIsoDateTimeSchema,
  IeltsLearnAtomSchema,
  IeltsPlanAtomKindSchema,
  IeltsPredictionSnapshotSchema,
  IeltsSkillSchema,
  IeltsWeaknessSignalSchema,
} from "@/lib/ielts/adaptive/contracts";

export const IeltsPlanningPredictionSchema = z.union([
  IeltsBandPredictionSchema,
  IeltsPredictionSnapshotSchema,
]);

export const IeltsReviewSeedSchema = z
  .object({
    reviewItemId: z.string().uuid(),
    skill: IeltsSkillSchema,
    focusArea: z.string().trim().min(1).max(160),
    dueAt: IeltsIsoDateTimeSchema,
    estimatedMinutes: z.number().int().min(1).max(60).optional(),
    priorityScore: z.number().min(0).optional(),
  })
  .strict();

export const IeltsTeacherAssignmentSeedSchema = z
  .object({
    assignmentId: z.string().uuid(),
    skill: IeltsSkillSchema,
    focusArea: z.string().trim().min(1).max(160),
    scheduledDate: IeltsIsoDateSchema,
    estimatedMinutes: z.number().int().min(1).max(240),
    kind: z
      .union([
        z.literal("teacher_assignment"),
        z.literal("mini_mock"),
        z.literal("full_mock"),
      ])
      .default("teacher_assignment"),
  })
  .strict();

export const GenerateIeltsStudyPlanInputSchema = z
  .object({
    goal: IeltsGoalModelSchema,
    prediction: IeltsPlanningPredictionSchema,
    weaknesses: z.array(IeltsWeaknessSignalSchema).optional(),
    learnAtoms: z.array(IeltsLearnAtomSchema).default([]),
    dueReviews: z.array(IeltsReviewSeedSchema).default([]),
    teacherAssignments: z.array(IeltsTeacherAssignmentSeedSchema).default([]),
    startDate: IeltsIsoDateSchema,
    horizonDays: z.number().int().min(1).max(30).default(14),
  })
  .strict();

export const PersistedIeltsPlanItemKindSchema = IeltsPlanAtomKindSchema;

export type ParsedGenerateIeltsStudyPlanInput = z.infer<
  typeof GenerateIeltsStudyPlanInputSchema
>;
