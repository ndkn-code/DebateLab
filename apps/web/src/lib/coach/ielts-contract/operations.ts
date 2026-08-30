import { z } from "zod";

import { ieltsCoachLocaleSchema } from "./contracts";

export const ieltsCoachMetricsTagsSchema = z
  .object({
    model: z.string().min(1).max(200),
    promptVersion: z.string().min(1).max(200),
    rubricVersion: z.string().min(1).max(200),
    locale: ieltsCoachLocaleSchema,
  })
  .strict();

export type IeltsCoachMetricsTags = z.infer<typeof ieltsCoachMetricsTagsSchema>;

/** Learner/teacher-safe terminal failure; provider internals remain in server logs. */
export const ieltsCoachTerminalErrorSchema = z
  .object({
    status: z.literal("terminal"),
    code: z.enum([
      "IELTS_COACH_TIMEOUT",
      "IELTS_COACH_PROVIDER_UNAVAILABLE",
      "IELTS_COACH_OUTPUT_INVALID",
      "IELTS_COACH_CONTEXT_BLOCKED",
      "IELTS_COACH_CONTEXT_UNAVAILABLE",
      "IELTS_COACH_INFRASTRUCTURE_UNAVAILABLE",
      "IELTS_COACH_SAFETY_ESCALATION",
      "IELTS_COACH_RETRY_EXHAUSTED",
    ]),
    runId: z.string().min(1).max(200),
    userMessage: z.string().min(1).max(500),
    attempt: z.number().int().positive(),
    maxAttempts: z.number().int().positive(),
    manualRetry: z
      .object({
        allowed: z.boolean(),
        idempotencyKey: z.string().min(1).max(200).nullable(),
        availableAt: z.string().datetime({ offset: true }).nullable(),
      })
      .strict(),
  })
  .strict()
  .superRefine((error, context) => {
    if (error.attempt < error.maxAttempts && !error.manualRetry.allowed) {
      context.addIssue({
        code: "custom",
        path: ["manualRetry", "allowed"],
        message:
          "bounded attempts remain, so safe manual retry must be available",
      });
    }
    if (error.manualRetry.allowed && !error.manualRetry.idempotencyKey) {
      context.addIssue({
        code: "custom",
        path: ["manualRetry", "idempotencyKey"],
        message: "manual retry requires an idempotency key",
      });
    }
  });

export type IeltsCoachTerminalError = z.infer<
  typeof ieltsCoachTerminalErrorSchema
>;
