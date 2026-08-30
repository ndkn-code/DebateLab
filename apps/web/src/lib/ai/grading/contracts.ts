import { z } from "zod";

export const AI_GRADING_MESSAGE_VERSION = 1 as const;
export const AI_GRADING_TOPIC = "ai-grading-jobs";
export const AI_GRADING_MAX_AUTOMATIC_ATTEMPTS = 3;
export const AI_GRADING_LEASE_SECONDS = 20 * 60;

export const aiGradingKindSchema = z.enum([
  "practice_analysis",
  "ielts_speaking_score",
  "ielts_writing_score",
]);

export type AiGradingKind = z.infer<typeof aiGradingKindSchema>;

/**
 * Pub/Sub carries references only. Student audio, transcripts, essays, prompts,
 * and user identifiers stay in Supabase and are loaded by the private worker.
 */
export const aiGradingJobSchema = z
  .object({
    schemaVersion: z.literal(AI_GRADING_MESSAGE_VERSION),
    kind: aiGradingKindSchema,
    sourceId: z.string().uuid(),
    workflowRunId: z.string().uuid(),
  })
  .strict();

export type AiGradingJob = z.infer<typeof aiGradingJobSchema>;

const pubSubEnvelopeSchema = z
  .object({
    message: z
      .object({
        data: z.string().min(1).max(16_384),
        messageId: z.string().min(1).max(200).optional(),
      })
      .passthrough(),
    deliveryAttempt: z.number().int().positive().max(1000).optional(),
  })
  .passthrough();

export type AiGradingDelivery = {
  job: AiGradingJob;
  messageId: string;
  deliveryAttempt: number;
};

export function parseAiGradingPubSubEnvelope(value: unknown): AiGradingDelivery {
  const envelope = pubSubEnvelopeSchema.parse(value);
  let decoded: unknown;
  try {
    decoded = JSON.parse(
      Buffer.from(envelope.message.data, "base64").toString("utf8"),
    );
  } catch {
    throw new Error("AI_GRADING_PUBSUB_DATA_INVALID");
  }
  const job = aiGradingJobSchema.parse(decoded);
  return {
    job,
    messageId: envelope.message.messageId ?? `missing:${job.workflowRunId}`,
    deliveryAttempt: envelope.deliveryAttempt ?? 1,
  };
}
export function aiGradingSourceColumn(kind: AiGradingKind) {
  if (kind === "practice_analysis") return "analysis_job_id" as const;
  if (kind === "ielts_speaking_score")
    return "speaking_response_id" as const;
  return "writing_response_id" as const;
}
