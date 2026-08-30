import { z } from "zod";

import { ieltsCoachSkillSchema, ieltsCriterionSchema } from "./contracts";

const observedSkillSignalSchema = z
  .object({
    skill: ieltsCoachSkillSchema,
    criterion: ieltsCriterionSchema,
    value: z.number().finite(),
    unit: z.enum(["band", "accuracy_percent", "rubric_indicator"]),
    authority: z.enum(["objective", "ai_provisional", "teacher_confirmed"]),
    observedAt: z.string().datetime({ offset: true }),
    evidenceId: z.string().min(1).max(200),
  })
  .strict();

export const ieltsCoachProgressSchema = z
  .object({
    product: z.literal("ielts"),
    recommendationId: z.string().min(1).max(200),
    learnerId: z.string().min(1).max(200),
    idempotencyKey: z.string().min(1).max(200),
    before: observedSkillSignalSchema,
    task: z
      .object({
        taskId: z.string().min(1).max(200),
        startedAt: z.string().datetime({ offset: true }).nullable(),
        completedAt: z.string().datetime({ offset: true }).nullable(),
      })
      .strict(),
    subsequentOutcome: observedSkillSignalSchema.nullable(),
    interpretation: z.literal("observed_association_not_causal"),
  })
  .strict()
  .superRefine((progress, context) => {
    if (progress.task.completedAt && !progress.task.startedAt) {
      context.addIssue({
        code: "custom",
        path: ["task", "completedAt"],
        message: "a task cannot be completed without a start event",
      });
    }
    if (
      progress.subsequentOutcome &&
      (progress.subsequentOutcome.skill !== progress.before.skill ||
        progress.subsequentOutcome.criterion !== progress.before.criterion ||
        progress.subsequentOutcome.unit !== progress.before.unit)
    ) {
      context.addIssue({
        code: "custom",
        path: ["subsequentOutcome"],
        message:
          "before and after signals must measure the same skill and criterion",
      });
    }
  });

export type IeltsCoachProgress = z.infer<typeof ieltsCoachProgressSchema>;

export const ieltsCoachFunnelEventSchema = z.discriminatedUnion("name", [
  z.object({
    name: z.literal("ielts_ai_coach_recommended_task"),
    product: z.literal("ielts"),
    learnerId: z.string().min(1),
    recommendationId: z.string().min(1),
    taskId: z.string().min(1),
    idempotencyKey: z.string().min(1),
    occurredAt: z.string().datetime({ offset: true }),
  }),
  z.object({
    name: z.literal("ielts_ai_coach_started_task"),
    product: z.literal("ielts"),
    learnerId: z.string().min(1),
    recommendationId: z.string().min(1),
    taskId: z.string().min(1),
    idempotencyKey: z.string().min(1),
    occurredAt: z.string().datetime({ offset: true }),
  }),
  z.object({
    name: z.literal("ielts_ai_coach_completed_task"),
    product: z.literal("ielts"),
    learnerId: z.string().min(1),
    recommendationId: z.string().min(1),
    taskId: z.string().min(1),
    idempotencyKey: z.string().min(1),
    occurredAt: z.string().datetime({ offset: true }),
  }),
]);

export type IeltsCoachFunnelEvent = z.infer<typeof ieltsCoachFunnelEventSchema>;
