import "server-only";

import Groq from "groq-sdk";

import { recordAiProviderRequest } from "@/lib/ai/provider-requests";

/**
 * Minimal typed Groq chat-completion helper (cheap-first fallback layer).
 *
 * Groq is already wired for Whisper STT; this adds the OpenAI-compatible chat
 * path (`llama-3.3-70b-versatile` by default) for JSON scoring tasks, metered
 * into `ai_provider_requests` like the other providers. It lets IELTS cards use
 * Gemini Flash primary + Groq fallback (masterplan §11) WITHOUT DeepSeek.
 */
export interface GroqChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GroqChatOptions {
  messages: GroqChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json_object";
  timeoutMs?: number;
  userId?: string | null;
  sourceRoute?: string;
  outputType?: string;
  metadata?: Record<string, unknown>;
}

export interface GroqChatResult {
  content: string;
  model: string;
  finishReason?: string;
}

const DEFAULT_MODEL = "llama-3.3-70b-versatile";
const DEFAULT_TIMEOUT_MS = 45_000;
const DEFAULT_TEMPERATURE = 0.2;

export function getGroqChatModelName(): string {
  return process.env.GROQ_CHAT_MODEL || DEFAULT_MODEL;
}

export function isGroqChatConfigured(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

function getClient(): Groq {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured");
  }
  return new Groq({ apiKey });
}

export async function createGroqChatCompletion(
  options: GroqChatOptions,
): Promise<GroqChatResult> {
  const model = options.model ?? getGroqChatModelName();
  const startedAt = Date.now();
  let logged = false;

  const record = async (input: {
    status: "success" | "error";
    finishReason?: string;
    usage?: Groq.Chat.Completions.ChatCompletion["usage"];
    resolvedModel?: string;
    errorCode?: string;
    errorMessage?: string;
  }) => {
    logged = true;
    await recordAiProviderRequest({
      provider: "groq",
      model: input.resolvedModel || model,
      status: input.status,
      sourceRoute: options.sourceRoute,
      outputType: options.outputType,
      userId: options.userId ?? undefined,
      finishReason: input.finishReason,
      latencyMs: Date.now() - startedAt,
      usage: {
        inputTokens: input.usage?.prompt_tokens,
        outputTokens: input.usage?.completion_tokens,
        totalTokens: input.usage?.total_tokens,
      },
      errorCode: input.errorCode,
      errorMessage: input.errorMessage,
      metadata: {
        responseFormat: options.responseFormat ?? "text",
        maxTokens: options.maxTokens ?? null,
        ...(options.metadata ?? {}),
      },
    });
  };

  try {
    const completion = await getClient().chat.completions.create(
      {
        model,
        messages: options.messages,
        temperature: options.temperature ?? DEFAULT_TEMPERATURE,
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
        ...(options.responseFormat === "json_object"
          ? { response_format: { type: "json_object" } }
          : {}),
      },
      { timeout: options.timeoutMs ?? DEFAULT_TIMEOUT_MS },
    );

    const choice = completion.choices[0];
    const content = choice?.message?.content?.trim() ?? "";
    const finishReason = choice?.finish_reason ?? undefined;

    if (!content) {
      await record({
        status: "error",
        finishReason,
        usage: completion.usage,
        resolvedModel: completion.model,
        errorCode: "EMPTY_RESPONSE",
        errorMessage: `Groq returned an empty response (finish_reason=${finishReason ?? "unknown"})`,
      });
      throw new Error("Groq returned an empty response");
    }

    await record({
      status: "success",
      finishReason,
      usage: completion.usage,
      resolvedModel: completion.model,
    });
    return { content, model: completion.model || model, finishReason };
  } catch (error) {
    if (!logged) {
      await record({
        status: "error",
        errorCode: "REQUEST_FAILED",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  }
}
