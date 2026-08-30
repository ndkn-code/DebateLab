import "server-only";

import { generateStructured } from "@/lib/ai/core";
import { isGroqChatConfigured } from "@/lib/ai/groq";
import {
  ieltsWritingModelOutputSchema,
  type IeltsWritingModelOutput,
} from "@/lib/scoring/ielts-writing/result-schema";
import { ieltsWritingAdjudicationOutputSchema } from "@/lib/ielts/scoring-adjudication";
import {
  IELTS_WRITING_SCORE_OUTPUT_TYPE,
  IELTS_WRITING_SCORE_SOURCE_ROUTE,
} from "./constants";
import { getIeltsWritingGroqModelName } from "./provider-policy";

/**
 * Centralized IELTS Writing model boundary. Product-specific configuration
 * uses Groq for live student data, while the core owns retries, deadlines,
 * schema validation, and provider telemetry. Gemini is intentionally excluded
 * because the application may be used by minors.
 */
const MAX_OUTPUT_TOKENS = 4096;
const TEMPERATURE = 0.2;

export interface WritingModelAudit {
  userId: string | null;
  writingResponseId: string | null;
}

export interface WritingModelResult {
  output: IeltsWritingModelOutput;
  providerLabel: string;
  modelName: string;
  traceId: string;
}

export async function runWritingModel(params: {
  prompt: string;
  audit: WritingModelAudit;
}): Promise<WritingModelResult> {
  if (!isGroqChatConfigured()) {
    throw new Error("No AI provider configured for IELTS Writing scoring");
  }
  const candidates = [
    { provider: "groq" as const, model: getIeltsWritingGroqModelName() },
  ];

  const result = await generateStructured({
    task: "ielts_writing_score",
    prompt: params.prompt,
    schema: ieltsWritingModelOutputSchema,
    context: {
      task: "ielts_writing_score",
      sourceRoute: IELTS_WRITING_SCORE_SOURCE_ROUTE,
      outputType: IELTS_WRITING_SCORE_OUTPUT_TYPE,
      userId: params.audit.userId,
      idempotencyKey: params.audit.writingResponseId ?? undefined,
      entity: {
        writingResponseId: params.audit.writingResponseId ?? undefined,
      },
      metadata: { writingResponseId: params.audit.writingResponseId },
    },
    policy: {
      candidates,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: TEMPERATURE,
    },
  });

  return {
    output: result.output,
    providerLabel: "groq",
    modelName: result.model,
    traceId: result.traceId,
  };
}

export async function adjudicateWritingModel(params: {
  prompt: string;
  audit: WritingModelAudit;
}): Promise<WritingModelResult> {
  if (!isGroqChatConfigured()) {
    throw new Error("No AI provider configured for IELTS Writing adjudication");
  }
  const result = await generateStructured({
    task: "ielts_writing_adjudication",
    prompt: params.prompt,
    schema: ieltsWritingAdjudicationOutputSchema,
    context: {
      task: "ielts_writing_adjudication",
      sourceRoute: IELTS_WRITING_SCORE_SOURCE_ROUTE,
      outputType: `${IELTS_WRITING_SCORE_OUTPUT_TYPE}_adjudication`,
      userId: params.audit.userId,
      idempotencyKey: params.audit.writingResponseId
        ? `${params.audit.writingResponseId}:adjudication`
        : undefined,
      entity: {
        writingResponseId: params.audit.writingResponseId ?? undefined,
      },
      metadata: { writingResponseId: params.audit.writingResponseId },
    },
    policy: {
      candidates: [{ provider: "groq", model: getIeltsWritingGroqModelName() }],
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: 0,
    },
  });
  return {
    output: result.output,
    providerLabel: "groq",
    modelName: result.model,
    traceId: result.traceId,
  };
}
