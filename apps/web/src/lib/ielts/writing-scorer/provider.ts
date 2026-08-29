import "server-only";

import { generateStructured } from "@/lib/ai/core";
import { getGeminiApiKeys } from "@/lib/gemini/key-pool";
import {
  ieltsWritingModelOutputSchema,
  type IeltsWritingModelOutput,
} from "@/lib/scoring/ielts-writing/result-schema";
import {
  IELTS_WRITING_SCORE_OUTPUT_TYPE,
  IELTS_WRITING_SCORE_SOURCE_ROUTE,
} from "./constants";
import {
  getIeltsWritingModelName,
  getIeltsWritingProviderLabel,
  getIeltsWritingScoreProvider,
  isIeltsWritingFallbackEnabled,
} from "./provider-policy";

/**
 * Centralized IELTS Writing model boundary. Product-specific configuration
 * controls candidate order, while the core owns retries, deadlines, schema
 * validation, Gemini key-pool rotation, and provider telemetry.
 */
const MAX_OUTPUT_TOKENS = 4096;
const TEMPERATURE = 0.2;
type WritingCandidateProvider = "gemini" | "deepseek";

export interface WritingModelAudit {
  userId: string | null;
  writingResponseId: string | null;
}

export interface WritingModelResult {
  output: IeltsWritingModelOutput;
  providerLabel: string;
  modelName: string;
}

function isDeepSeekConfigured(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

export async function runWritingModel(params: {
  prompt: string;
  audit: WritingModelAudit;
}): Promise<WritingModelResult> {
  const primary = getIeltsWritingScoreProvider();
  const available = {
    gemini: getGeminiApiKeys().length > 0,
    deepseek: isDeepSeekConfigured(),
  };
  const secondary: WritingCandidateProvider = primary === "gemini" ? "deepseek" : "gemini";
  const candidateProviders: WritingCandidateProvider[] = isIeltsWritingFallbackEnabled()
    ? [primary, secondary]
    : [primary];
  const candidates = candidateProviders
    .filter((provider) => available[provider])
    .map((provider) => ({ provider, model: getIeltsWritingModelName(provider) }));
  if (candidates.length === 0) {
    throw new Error("No AI provider configured for IELTS Writing scoring");
  }

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
      entity: { writingResponseId: params.audit.writingResponseId ?? undefined },
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
    providerLabel: getIeltsWritingProviderLabel(
      result.provider === "gemini" ? "gemini" : "deepseek"
    ),
    modelName: result.model,
  };
}
