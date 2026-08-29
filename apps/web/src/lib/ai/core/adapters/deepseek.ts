import type { AdapterRequest, AdapterResponse } from "./types";
import { configured, retryAfterMs } from "./shared";

interface DeepSeekResponse {
  model?: string;
  choices?: Array<{ finish_reason?: string; message?: { content?: string | null } }>;
  usage?: {
    prompt_tokens?: number;
    prompt_cache_hit_tokens?: number;
    prompt_cache_miss_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    completion_tokens_details?: { reasoning_tokens?: number };
  };
  error?: { message?: string };
}

export async function generateDeepSeek(request: AdapterRequest): Promise<AdapterResponse> {
  const apiKey = configured(process.env.DEEPSEEK_API_KEY, "DEEPSEEK_API_KEY");
  const baseUrl = (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(/\/+$/, "");
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal: request.signal,
    body: JSON.stringify({
      model: request.model,
      messages: request.messages,
      thinking: { type: "disabled" },
      temperature: request.temperature,
      max_tokens: request.maxOutputTokens,
      ...(request.responseFormat === "json" ? { response_format: { type: "json_object" } } : {}),
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as DeepSeekResponse;
  if (!response.ok) {
    const error = new Error(payload.error?.message || `DeepSeek request failed (${response.status})`) as Error & { status: number; retryAfterMs?: number };
    error.status = response.status;
    error.retryAfterMs = retryAfterMs(response);
    throw error;
  }
  const choice = payload.choices?.[0];
  const text = choice?.message?.content?.trim() ?? "";
  if (!text) {
    const error = new Error("DeepSeek returned an empty response") as Error & { status: number };
    error.status = 503;
    throw error;
  }
  return {
    text,
    finishReason: choice?.finish_reason ?? null,
    responseStatus: response.status,
    usage: {
      inputTokens: payload.usage?.prompt_tokens,
      outputTokens: payload.usage?.completion_tokens,
      totalTokens: payload.usage?.total_tokens,
      cacheHitTokens: payload.usage?.prompt_cache_hit_tokens,
      cacheMissTokens: payload.usage?.prompt_cache_miss_tokens,
      reasoningTokens: payload.usage?.completion_tokens_details?.reasoning_tokens,
    },
  };
}
