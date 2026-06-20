import "server-only";

import {
  classifyGeminiError,
  getGeminiApiKeys,
  getGeminiClientForSlot,
  runWithGeminiKeyPool,
} from "@/lib/gemini/key-pool";
import { createDeepSeekChatCompletion } from "@/lib/ai/deepseek";
import { recordAiProviderRequest } from "@/lib/ai/provider-requests";
import {
  ieltsWritingModelOutputSchema,
  type IeltsWritingModelOutput,
} from "@/lib/scoring/ielts-writing/result-schema";
import { extractJsonObject } from "./json";
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
 * The actual scoring model call (WS-3.1). Cheap-first: Gemini Flash via the
 * key-pool (JSON mode) is primary; DeepSeek is the configurable fallback. Each
 * call is metered into `ai_provider_requests`, and the raw JSON is validated
 * against {@link ieltsWritingModelOutputSchema} before it reaches the scorer.
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
}

function isDeepSeekConfigured(): boolean {
  return Boolean(process.env.DEEPSEEK_API_KEY);
}

function validate(text: string, label: string): IeltsWritingModelOutput {
  return ieltsWritingModelOutputSchema.parse(extractJsonObject(text, label));
}

async function runViaGemini(
  prompt: string,
  audit: WritingModelAudit,
): Promise<WritingModelResult> {
  const modelName = getIeltsWritingModelName("gemini");
  const providerLabel = getIeltsWritingProviderLabel("gemini");
  return runWithGeminiKeyPool({
    seed: `ielts-writing:${audit.writingResponseId ?? "anon"}`,
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
        sourceRoute: IELTS_WRITING_SCORE_SOURCE_ROUTE,
        outputType: IELTS_WRITING_SCORE_OUTPUT_TYPE,
        userId: audit.userId,
        latencyMs,
        usage: {
          inputTokens: result.response.usageMetadata?.promptTokenCount,
          outputTokens: result.response.usageMetadata?.candidatesTokenCount,
          totalTokens: result.response.usageMetadata?.totalTokenCount,
        },
        metadata: {
          writingResponseId: audit.writingResponseId,
          keySlot: attempt.slot,
          keyFallbackCount: attempt.fallbackCount,
        },
      });
      return {
        output: validate(result.response.text(), "ielts_writing_gemini"),
        providerLabel,
        modelName,
      };
    },
    onError: async (error, attempt) => {
      await recordAiProviderRequest({
        provider: "google",
        model: modelName,
        status: "error",
        sourceRoute: IELTS_WRITING_SCORE_SOURCE_ROUTE,
        outputType: IELTS_WRITING_SCORE_OUTPUT_TYPE,
        userId: audit.userId,
        errorCode: classifyGeminiError(error),
        errorMessage: error instanceof Error ? error.message : String(error),
        metadata: {
          writingResponseId: audit.writingResponseId,
          keySlot: attempt.slot,
        },
      });
    },
  });
}

async function runViaDeepSeek(
  prompt: string,
  audit: WritingModelAudit,
  fallbackFromGemini: boolean,
): Promise<WritingModelResult> {
  const modelName = getIeltsWritingModelName("deepseek");
  const providerLabel = getIeltsWritingProviderLabel("deepseek");
  const result = await createDeepSeekChatCompletion({
    messages: [{ role: "user", content: prompt }],
    thinking: { type: "disabled" },
    responseFormat: "json_object",
    temperature: TEMPERATURE,
    maxTokens: MAX_OUTPUT_TOKENS,
    userId: audit.userId ?? undefined,
    sourceRoute: IELTS_WRITING_SCORE_SOURCE_ROUTE,
    outputType: IELTS_WRITING_SCORE_OUTPUT_TYPE,
    timeoutMs: fallbackFromGemini ? 45_000 : 30_000,
    metadata: { writingResponseId: audit.writingResponseId },
  });
  return {
    output: validate(result.content, "ielts_writing_deepseek"),
    providerLabel,
    modelName,
  };
}

export async function runWritingModel(params: {
  prompt: string;
  audit: WritingModelAudit;
}): Promise<WritingModelResult> {
  const primary = getIeltsWritingScoreProvider();
  const geminiReady = getGeminiApiKeys().length > 0;
  const deepSeekReady = isDeepSeekConfigured();

  if (primary === "gemini" && geminiReady) {
    try {
      return await runViaGemini(params.prompt, params.audit);
    } catch (error) {
      if (!isIeltsWritingFallbackEnabled() || !deepSeekReady) {
        throw error;
      }
    }
    return runViaDeepSeek(params.prompt, params.audit, true);
  }

  if (deepSeekReady) {
    return runViaDeepSeek(params.prompt, params.audit, false);
  }
  if (geminiReady) {
    return runViaGemini(params.prompt, params.audit);
  }
  throw new Error("No AI provider configured for IELTS Writing scoring");
}
