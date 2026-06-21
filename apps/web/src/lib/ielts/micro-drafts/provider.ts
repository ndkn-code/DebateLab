import "server-only";

import {
  classifyGeminiError,
  getGeminiApiKeys,
  getGeminiClientForSlot,
  runWithGeminiKeyPool,
} from "@/lib/gemini/key-pool";
import { createGroqChatCompletion, isGroqChatConfigured } from "@/lib/ai/groq";
import { getProviderLabel, getProviderModelName } from "@/lib/ai/provider-selection";
import { recordAiProviderRequest } from "@/lib/ai/provider-requests";
import { extractJsonObject } from "@/lib/ielts/writing-scorer/json";
import { GeneratedMicroDraftsSchema, type GeneratedMicroDraft } from "./schema";

const TEMPERATURE = 0.15;
const MAX_OUTPUT_TOKENS = 4096;
const SOURCE_ROUTE = "ielts_micro_item_drafts";
const OUTPUT_TYPE = "ielts_micro_item_drafts";
const GROQ_TIMEOUT_MS = 45_000;

export interface MicroDraftModelAudit {
  userId: string | null;
  questionId: string;
}

export interface MicroDraftModelResult {
  drafts: GeneratedMicroDraft[];
  providerLabel: string;
  modelName: string;
}

function validateDrafts(text: string, label: string): GeneratedMicroDraft[] {
  return GeneratedMicroDraftsSchema.parse(extractJsonObject(text, label)).drafts;
}

function isFallbackEnabled(): boolean {
  const normalized = process.env.IELTS_MICRO_DRAFT_FALLBACK_PROVIDER
    ?.trim()
    .toLowerCase();
  return !(
    normalized === "none" ||
    normalized === "off" ||
    normalized === "false" ||
    normalized === "disabled"
  );
}

async function runViaGemini(
  prompt: string,
  audit: MicroDraftModelAudit,
): Promise<MicroDraftModelResult> {
  const modelName = getProviderModelName("gemini");
  const providerLabel = getProviderLabel("gemini");

  return runWithGeminiKeyPool({
    seed: `ielts-micro-draft:${audit.questionId}`,
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
        provider: providerLabel,
        model: modelName,
        status: "success",
        sourceRoute: SOURCE_ROUTE,
        outputType: OUTPUT_TYPE,
        userId: audit.userId,
        latencyMs,
        usage: {
          inputTokens: result.response.usageMetadata?.promptTokenCount,
          outputTokens: result.response.usageMetadata?.candidatesTokenCount,
          totalTokens: result.response.usageMetadata?.totalTokenCount,
        },
        metadata: {
          questionId: audit.questionId,
          keySlot: attempt.slot,
          keyFallbackCount: attempt.fallbackCount,
        },
      });
      return {
        drafts: validateDrafts(result.response.text(), "ielts_micro_drafts_gemini"),
        providerLabel,
        modelName,
      };
    },
    onError: async (error, attempt) => {
      await recordAiProviderRequest({
        provider: providerLabel,
        model: modelName,
        status: "error",
        sourceRoute: SOURCE_ROUTE,
        outputType: OUTPUT_TYPE,
        userId: audit.userId,
        errorCode: classifyGeminiError(error),
        errorMessage: error instanceof Error ? error.message : String(error),
        metadata: {
          questionId: audit.questionId,
          keySlot: attempt.slot,
        },
      });
    },
  });
}

async function runViaGroq(
  prompt: string,
  audit: MicroDraftModelAudit,
): Promise<MicroDraftModelResult> {
  const result = await createGroqChatCompletion({
    messages: [{ role: "user", content: prompt }],
    responseFormat: "json_object",
    temperature: TEMPERATURE,
    maxTokens: MAX_OUTPUT_TOKENS,
    timeoutMs: GROQ_TIMEOUT_MS,
    userId: audit.userId,
    sourceRoute: SOURCE_ROUTE,
    outputType: OUTPUT_TYPE,
    metadata: { questionId: audit.questionId },
  });

  return {
    drafts: validateDrafts(result.content, "ielts_micro_drafts_groq"),
    providerLabel: "groq",
    modelName: result.model,
  };
}

export async function runMicroDraftModel(params: {
  prompt: string;
  audit: MicroDraftModelAudit;
}): Promise<MicroDraftModelResult> {
  const geminiReady = getGeminiApiKeys().length > 0;
  const groqReady = isGroqChatConfigured();

  if (geminiReady) {
    try {
      return await runViaGemini(params.prompt, params.audit);
    } catch (error) {
      if (!isFallbackEnabled() || !groqReady) {
        throw error;
      }
    }
    return runViaGroq(params.prompt, params.audit);
  }

  if (groqReady) {
    return runViaGroq(params.prompt, params.audit);
  }
  throw new Error("No AI provider configured for IELTS micro-item drafting");
}
