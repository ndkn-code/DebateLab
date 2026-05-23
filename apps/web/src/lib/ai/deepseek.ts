import "server-only";

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
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 55_000
  );

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

    const payload = (await response.json().catch(() => ({}))) as DeepSeekResponse;

    if (!response.ok) {
      const message =
        payload.error?.message || `DeepSeek request failed with ${response.status}`;
      throw new Error(message);
    }

    const choice = payload.choices?.[0];
    const content = choice?.message?.content?.trim() ?? "";
    const finishReason = choice?.finish_reason;

    if (!content) {
      const reasoningLength = choice?.message?.reasoning_content?.length ?? 0;
      throw new Error(
        `DeepSeek returned an empty response (finish_reason=${finishReason ?? "unknown"}, reasoning_chars=${reasoningLength}, prompt_tokens=${payload.usage?.prompt_tokens ?? "unknown"}, completion_tokens=${payload.usage?.completion_tokens ?? "unknown"})`
      );
    }

    if (finishReason === "content_filter" || finishReason === "insufficient_system_resource") {
      throw new Error(`DeepSeek finish_reason=${finishReason}`);
    }

    return {
      content,
      reasoningContent: choice?.message?.reasoning_content,
      model: payload.model || getDeepSeekModelName(),
      finishReason,
      usage: payload.usage,
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("TIMEOUT");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
