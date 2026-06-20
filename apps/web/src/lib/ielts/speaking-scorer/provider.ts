import "server-only";

import {
  classifyGeminiError,
  getGeminiApiKeys,
  getGeminiClientForSlot,
  runWithGeminiKeyPool,
} from "@/lib/gemini/key-pool";
import { createGroqChatCompletion, isGroqChatConfigured } from "@/lib/ai/groq";
import { recordAiProviderRequest } from "@/lib/ai/provider-requests";
import {
  ieltsSpeakingModelOutputSchema,
  type IeltsSpeakingModelOutput,
} from "@/lib/scoring/ielts-speaking/result-schema";
import { extractJsonObject } from "@/lib/ielts/writing-scorer/json";
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
 * The actual scoring model call (WS-3.2). Cheap-first: Gemini Flash via the
 * key-pool (JSON mode) is primary; Groq (`llama-3.3-70b-versatile`) is the
 * configurable fallback — NOT DeepSeek. Each call is metered into
 * `ai_provider_requests`, and the raw JSON is validated against
 * {@link ieltsSpeakingModelOutputSchema} before it reaches the scorer. Mirrors
 * the Writing provider.
 */
const MAX_OUTPUT_TOKENS = 3072;
const TEMPERATURE = 0.2;
const GROQ_TIMEOUT_MS = 45_000;

export interface SpeakingModelAudit {
  userId: string | null;
  speakingResponseId: string | null;
}

export interface SpeakingModelResult {
  output: IeltsSpeakingModelOutput;
  providerLabel: string;
  modelName: string;
}

function validate(text: string, label: string): IeltsSpeakingModelOutput {
  return ieltsSpeakingModelOutputSchema.parse(extractJsonObject(text, label));
}

async function runViaGemini(
  prompt: string,
  audit: SpeakingModelAudit,
): Promise<SpeakingModelResult> {
  const modelName = getIeltsSpeakingGeminiModelName();
  const providerLabel = getIeltsSpeakingGeminiProviderLabel();
  return runWithGeminiKeyPool({
    seed: `ielts-speaking:${audit.speakingResponseId ?? "anon"}`,
    run: async (attempt) => {
      const model = getGeminiClientForSlot(attempt.slot).getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: "application/json",
          temperature: TEMPERATURE,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
        },
      });
      const startedAt = Date.now();
      const result = await model.generateContent(prompt);
      const latencyMs = Date.now() - startedAt;
      await recordAiProviderRequest({
        provider: "google",
        model: modelName,
        status: "success",
        sourceRoute: IELTS_SPEAKING_SCORE_SOURCE_ROUTE,
        outputType: IELTS_SPEAKING_SCORE_OUTPUT_TYPE,
        userId: audit.userId,
        latencyMs,
        usage: {
          inputTokens: result.response.usageMetadata?.promptTokenCount,
          outputTokens: result.response.usageMetadata?.candidatesTokenCount,
          totalTokens: result.response.usageMetadata?.totalTokenCount,
        },
        metadata: {
          speakingResponseId: audit.speakingResponseId,
          keySlot: attempt.slot,
          keyFallbackCount: attempt.fallbackCount,
        },
      });
      return {
        output: validate(result.response.text(), "ielts_speaking_gemini"),
        providerLabel,
        modelName,
      };
    },
    onError: async (error, attempt) => {
      await recordAiProviderRequest({
        provider: "google",
        model: modelName,
        status: "error",
        sourceRoute: IELTS_SPEAKING_SCORE_SOURCE_ROUTE,
        outputType: IELTS_SPEAKING_SCORE_OUTPUT_TYPE,
        userId: audit.userId,
        errorCode: classifyGeminiError(error),
        errorMessage: error instanceof Error ? error.message : String(error),
        metadata: {
          speakingResponseId: audit.speakingResponseId,
          keySlot: attempt.slot,
        },
      });
    },
  });
}

async function runViaGroq(
  prompt: string,
  audit: SpeakingModelAudit,
): Promise<SpeakingModelResult> {
  const result = await createGroqChatCompletion({
    messages: [{ role: "user", content: prompt }],
    responseFormat: "json_object",
    temperature: TEMPERATURE,
    maxTokens: MAX_OUTPUT_TOKENS,
    timeoutMs: GROQ_TIMEOUT_MS,
    userId: audit.userId,
    sourceRoute: IELTS_SPEAKING_SCORE_SOURCE_ROUTE,
    outputType: IELTS_SPEAKING_SCORE_OUTPUT_TYPE,
    metadata: { speakingResponseId: audit.speakingResponseId },
  });
  return {
    output: validate(result.content, "ielts_speaking_groq"),
    providerLabel: IELTS_SPEAKING_GROQ_PROVIDER_LABEL,
    modelName: getIeltsSpeakingGroqModelName(),
  };
}

export async function runSpeakingModel(params: {
  prompt: string;
  audit: SpeakingModelAudit;
}): Promise<SpeakingModelResult> {
  const geminiReady = getGeminiApiKeys().length > 0;
  const groqReady = isGroqChatConfigured();

  if (geminiReady) {
    try {
      return await runViaGemini(params.prompt, params.audit);
    } catch (error) {
      if (!isIeltsSpeakingFallbackEnabled() || !groqReady) {
        throw error;
      }
    }
    return runViaGroq(params.prompt, params.audit);
  }

  if (groqReady) {
    return runViaGroq(params.prompt, params.audit);
  }
  throw new Error("No AI provider configured for IELTS Speaking scoring");
}
