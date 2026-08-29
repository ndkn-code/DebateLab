import "server-only";

import { generateStructured } from "@/lib/ai/core";
import { isGroqChatConfigured } from "@/lib/ai/groq";
import { getGeminiApiKeys } from "@/lib/gemini/key-pool";
import {
  ieltsSpeakingModelOutputSchema,
  type IeltsSpeakingModelOutput,
} from "@/lib/scoring/ielts-speaking/result-schema";
import {
  IELTS_SPEAKING_SCORE_OUTPUT_TYPE,
  IELTS_SPEAKING_SCORE_SOURCE_ROUTE,
} from "./constants";
import {
  IELTS_SPEAKING_GROQ_PROVIDER_LABEL,
  getIeltsSpeakingGeminiModelName,
  getIeltsSpeakingGeminiProviderLabel,
  getIeltsSpeakingGroqModelName,
  isIeltsSpeakingFallbackEnabled,
} from "./provider-policy";

/**
 * Centralized IELTS Speaking model boundary. This preserves the existing
 * Gemini-first/Groq-fallback product policy while delegating key rotation,
 * deadlines, JSON repair, and provider audit to the AI core.
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
}

export async function runSpeakingModel(params: {
  prompt: string;
  audit: SpeakingModelAudit;
}): Promise<SpeakingModelResult> {
  const candidates = [] as Array<{ provider: "gemini" | "groq"; model: string }>;
  if (getGeminiApiKeys().length > 0) {
    candidates.push({ provider: "gemini", model: getIeltsSpeakingGeminiModelName() });
  }
  if (isIeltsSpeakingFallbackEnabled() && isGroqChatConfigured()) {
    candidates.push({ provider: "groq", model: getIeltsSpeakingGroqModelName() });
  }
  if (candidates.length === 0) {
    throw new Error("No AI provider configured for IELTS Speaking scoring");
  }

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
      entity: { speakingResponseId: params.audit.speakingResponseId ?? undefined },
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
    providerLabel:
      result.provider === "gemini"
        ? getIeltsSpeakingGeminiProviderLabel()
        : IELTS_SPEAKING_GROQ_PROVIDER_LABEL,
    modelName: result.model,
  };
}
