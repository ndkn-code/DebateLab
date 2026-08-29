import type { AdapterRequest, AdapterResponse } from "./types";
import { configured, retryAfterMs } from "./shared";
import {
  getGeminiApiKeys,
  recordGeminiKeyFailure,
  recordGeminiKeySuccess,
  selectGeminiKeyAttempts,
  shouldTryNextGeminiKey,
} from "@/lib/gemini/key-pool";

interface GeminiResponse {
  candidates?: Array<{
    finishReason?: string;
    content?: { parts?: Array<{ text?: string }> };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: { message?: string; code?: number; status?: string };
}

export async function generateGemini(request: AdapterRequest): Promise<AdapterResponse> {
  if (getGeminiApiKeys().length === 0) {
    configured(undefined, "GEMINI_API_KEY or GEMINI_API_KEYS");
  }
  let lastError: unknown = null;
  const attempts = selectGeminiKeyAttempts(`${request.context.traceId}:${request.model}`);
  for (const keyAttempt of attempts) {
    const apiKey = getGeminiApiKeys()[keyAttempt.slot]!;
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(request.model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
        {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: request.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: request.messages.map((message) => `${message.role.toUpperCase()}:\n${message.content}`).join("\n\n") }] }],
        generationConfig: {
          ...(request.responseFormat === "json" ? { responseMimeType: "application/json" } : {}),
          temperature: request.temperature,
          maxOutputTokens: request.maxOutputTokens,
        },
      }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as GeminiResponse;
      if (!response.ok) {
        const error = new Error(payload.error?.message || `Gemini request failed (${response.status})`) as Error & { status: number; retryAfterMs?: number };
        error.status = response.status;
        error.retryAfterMs = retryAfterMs(response);
        throw error;
      }
      const candidate = payload.candidates?.[0];
      const text = candidate?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
      if (!text) {
        const error = new Error("Gemini returned an empty response") as Error & { status: number };
        error.status = 503;
        throw error;
      }
      recordGeminiKeySuccess(keyAttempt.slot);
      return {
        text,
        finishReason: candidate?.finishReason ?? null,
        responseStatus: response.status,
        usage: {
          inputTokens: payload.usageMetadata?.promptTokenCount,
          outputTokens: payload.usageMetadata?.candidatesTokenCount,
          totalTokens: payload.usageMetadata?.totalTokenCount,
        },
      };
    } catch (error) {
      lastError = error;
      recordGeminiKeyFailure(keyAttempt.slot, error);
      if (!shouldTryNextGeminiKey(error) || request.signal.aborted) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Gemini request failed");
}
