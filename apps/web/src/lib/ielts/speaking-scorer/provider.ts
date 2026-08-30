import "server-only";

import { generateStructured } from "@/lib/ai/core";
import { isGroqChatConfigured } from "@/lib/ai/groq";
import {
  ieltsSpeakingModelOutputSchema,
  type IeltsSpeakingModelOutput,
} from "@/lib/scoring/ielts-speaking/result-schema";
import { ieltsSpeakingAdjudicationOutputSchema } from "@/lib/ielts/scoring-adjudication";
import {
  IELTS_SPEAKING_SCORE_OUTPUT_TYPE,
  IELTS_SPEAKING_SCORE_SOURCE_ROUTE,
} from "./constants";
import {
  IELTS_SPEAKING_GROQ_PROVIDER_LABEL,
  getIeltsSpeakingGroqModelName,
} from "./provider-policy";

/**
 * Centralized IELTS Speaking model boundary. This preserves the existing
 * Groq-only live-student policy while delegating deadlines, JSON repair, and
 * provider audit to the AI core. Gemini is intentionally excluded because the
 * application may be used by minors.
 */
const MAX_OUTPUT_TOKENS = 3072;
const TEMPERATURE = 0.2;

export interface SpeakingModelAudit {
  userId: string | null;
  speakingResponseId: string | null;
}

export interface SpeakingModelResult {
  output: IeltsSpeakingModelOutput;
  providerLabel: string;
  modelName: string;
  traceId: string;
}

export async function runSpeakingModel(params: {
  prompt: string;
  audit: SpeakingModelAudit;
}): Promise<SpeakingModelResult> {
  if (!isGroqChatConfigured()) {
    throw new Error("No AI provider configured for IELTS Speaking scoring");
  }
  const candidates = [
    { provider: "groq" as const, model: getIeltsSpeakingGroqModelName() },
  ];

  const result = await generateStructured({
    task: "ielts_speaking_score",
    prompt: params.prompt,
    schema: ieltsSpeakingModelOutputSchema,
    context: {
      task: "ielts_speaking_score",
      sourceRoute: IELTS_SPEAKING_SCORE_SOURCE_ROUTE,
      outputType: IELTS_SPEAKING_SCORE_OUTPUT_TYPE,
      userId: params.audit.userId,
      idempotencyKey: params.audit.speakingResponseId ?? undefined,
      entity: {
        speakingResponseId: params.audit.speakingResponseId ?? undefined,
      },
      metadata: { speakingResponseId: params.audit.speakingResponseId },
    },
    policy: {
      candidates,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: TEMPERATURE,
    },
  });

  return {
    output: result.output,
    providerLabel: IELTS_SPEAKING_GROQ_PROVIDER_LABEL,
    modelName: result.model,
    traceId: result.traceId,
  };
}

export async function adjudicateSpeakingModel(params: {
  prompt: string;
  audit: SpeakingModelAudit;
}): Promise<SpeakingModelResult> {
  if (!isGroqChatConfigured()) {
    throw new Error(
      "No AI provider configured for IELTS Speaking adjudication",
    );
  }
  const result = await generateStructured({
    task: "ielts_speaking_adjudication",
    prompt: params.prompt,
    schema: ieltsSpeakingAdjudicationOutputSchema,
    context: {
      task: "ielts_speaking_adjudication",
      sourceRoute: IELTS_SPEAKING_SCORE_SOURCE_ROUTE,
      outputType: `${IELTS_SPEAKING_SCORE_OUTPUT_TYPE}_adjudication`,
      userId: params.audit.userId,
      idempotencyKey: params.audit.speakingResponseId
        ? `${params.audit.speakingResponseId}:adjudication`
        : undefined,
      entity: {
        speakingResponseId: params.audit.speakingResponseId ?? undefined,
      },
      metadata: { speakingResponseId: params.audit.speakingResponseId },
    },
    policy: {
      candidates: [
        { provider: "groq", model: getIeltsSpeakingGroqModelName() },
      ],
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: 0,
    },
  });
  return {
    output: result.output,
    providerLabel: IELTS_SPEAKING_GROQ_PROVIDER_LABEL,
    modelName: result.model,
    traceId: result.traceId,
  };
}
