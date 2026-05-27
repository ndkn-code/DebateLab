import "server-only";

import { recordAiProviderRequest } from "@/lib/ai/provider-requests";

export type DeepSeekThinkingMode = "enabled" | "disabled";

export interface DeepSeekMessage {
  role: "system" | "user" | "assistant";
  content: string;
  name?: string;
}

export interface DeepSeekUsage {
  prompt_tokens?: number;
  prompt_cache_hit_tokens?: number;
  prompt_cache_miss_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  completion_tokens_details?: {
    reasoning_tokens?: number;
  };
}

export interface DeepSeekChatResult {
  content: string;
  reasoningContent?: string | null;
  model: string;
  finishReason?: string;
  usage?: DeepSeekUsage;
  providerRequestId?: string | null;
}

export interface DeepSeekChatOptions {
  messages: DeepSeekMessage[];
  thinking: {
    type: DeepSeekThinkingMode;
    reasoningEffort?: "high" | "max";
  };
  maxTokens?: number;
  temperature?: number;
  responseFormat?: "text" | "json_object";
  userId?: string;
  timeoutMs?: number;
  sourceRoute?: string;
  outputType?: string;
  practiceAttemptId?: string;
  analysisJobId?: string;
  debateSessionId?: string;
  metadata?: Record<string, unknown>;
}

interface DeepSeekResponse {
  model?: string;
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?: string | null;
      reasoning_content?: string | null;
    };
  }>;
  usage?: DeepSeekUsage;
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
}

function getDeepSeekApiKey() {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not configured");
  }
  return apiKey;
}

function getDeepSeekBaseUrl() {
  return (process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com").replace(
    /\/+$/,
    ""
  );
}

export function getDeepSeekModelName() {
  return process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
}

function createUserId(value: string | undefined) {
  if (!value) return undefined;
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 512);
}

export async function createDeepSeekChatCompletion(
  options: DeepSeekChatOptions
): Promise<DeepSeekChatResult> {
  const controller = new AbortController();
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 55_000
  );
  let payload: DeepSeekResponse | null = null;
  let responseStatus: number | null = null;
  let finishReason: string | null = null;
  let requestLogged = false;
  let providerRequestId: string | null = null;

  const recordRequest = async (input: {
    status: "success" | "error";
    errorCode?: string | null;
    errorMessage?: string | null;
  }) => {
    requestLogged = true;
    providerRequestId = await recordAiProviderRequest({
      provider: "deepseek",
      model: payload?.model || getDeepSeekModelName(),
      status: input.status,
      sourceRoute: options.sourceRoute,
      outputType: options.outputType,
      userId: options.userId,
      requestId,
      responseStatus,
      finishReason,
      latencyMs: Date.now() - startedAt,
      usage: {
        inputTokens: payload?.usage?.prompt_tokens,
        outputTokens: payload?.usage?.completion_tokens,
        totalTokens: payload?.usage?.total_tokens,
        cacheHitTokens: payload?.usage?.prompt_cache_hit_tokens,
        cacheMissTokens: payload?.usage?.prompt_cache_miss_tokens,
        reasoningTokens:
          payload?.usage?.completion_tokens_details?.reasoning_tokens,
      },
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      practiceAttemptId: options.practiceAttemptId,
      analysisJobId: options.analysisJobId,
      debateSessionId: options.debateSessionId,
      metadata: {
        thinkingType: options.thinking.type,
        responseFormat: options.responseFormat ?? "text",
        maxTokens: options.maxTokens ?? null,
        ...(options.metadata ?? {}),
      },
    });
  };

  try {
    const userId = createUserId(options.userId);
    const body: Record<string, unknown> = {
      model: getDeepSeekModelName(),
      messages: options.messages,
      thinking: {
        type: options.thinking.type,
        ...(options.thinking.reasoningEffort
          ? { reasoning_effort: options.thinking.reasoningEffort }
          : {}),
      },
      ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
      ...(options.responseFormat
        ? { response_format: { type: options.responseFormat } }
        : {}),
      ...(options.thinking.type === "disabled" && options.temperature != null
        ? { temperature: options.temperature }
        : {}),
      ...(userId ? { user_id: userId } : {}),
    };

    const response = await fetch(`${getDeepSeekBaseUrl()}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${getDeepSeekApiKey()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    responseStatus = response.status;

    payload = (await response.json().catch(() => ({}))) as DeepSeekResponse;

    if (!response.ok) {
      const message =
        payload.error?.message || `DeepSeek request failed with ${response.status}`;
      await recordRequest({
        status: "error",
        errorCode: payload.error?.code || String(response.status),
        errorMessage: message,
      });
      throw new Error(message);
    }

    const choice = payload.choices?.[0];
    const content = choice?.message?.content?.trim() ?? "";
    finishReason = choice?.finish_reason ?? null;

    if (!content) {
      const reasoningLength = choice?.message?.reasoning_content?.length ?? 0;
      const message = `DeepSeek returned an empty response (finish_reason=${finishReason ?? "unknown"}, reasoning_chars=${reasoningLength}, prompt_tokens=${payload.usage?.prompt_tokens ?? "unknown"}, completion_tokens=${payload.usage?.completion_tokens ?? "unknown"})`;
      await recordRequest({
        status: "error",
        errorCode: "EMPTY_RESPONSE",
        errorMessage: message,
      });
      throw new Error(message);
    }

    if (finishReason === "content_filter" || finishReason === "insufficient_system_resource") {
      const message = `DeepSeek finish_reason=${finishReason}`;
      await recordRequest({
        status: "error",
        errorCode: finishReason,
        errorMessage: message,
      });
      throw new Error(message);
    }

    await recordRequest({ status: "success" });
    return {
      content,
      reasoningContent: choice?.message?.reasoning_content,
      model: payload.model || getDeepSeekModelName(),
      finishReason: finishReason ?? undefined,
      usage: payload.usage,
      providerRequestId,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      await recordRequest({
        status: "error",
        errorCode: "TIMEOUT",
        errorMessage: "TIMEOUT",
      });
      throw new Error("TIMEOUT");
    }
    if (!requestLogged) {
      await recordRequest({
        status: "error",
        errorCode: "REQUEST_FAILED",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
