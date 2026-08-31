import type { AdapterRequest, AdapterResponse } from "./types";
import { configured, retryAfterMs } from "./shared";

interface GroqResponse {
  model?: string;
  choices?: Array<{ finish_reason?: string; message?: { content?: string | null } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  error?: { message?: string };
}

function supportsStrictJsonSchema(model: string) {
  return model === "openai/gpt-oss-20b" || model === "openai/gpt-oss-120b";
}

export async function generateGroq(request: AdapterRequest): Promise<AdapterResponse> {
  const apiKey = configured(process.env.GROQ_API_KEY, "GROQ_API_KEY");
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    signal: request.signal,
    body: JSON.stringify({
      model: request.model,
      messages: request.messages,
      temperature: request.temperature,
      max_tokens: request.maxOutputTokens,
      ...(request.responseFormat === "json"
        ? {
            response_format:
              request.jsonSchema && supportsStrictJsonSchema(request.model)
                ? {
                    type: "json_schema",
                    json_schema: {
                      name: request.jsonSchema.name,
                      strict: true,
                      schema: request.jsonSchema.schema,
                    },
                  }
                : { type: "json_object" },
          }
        : {}),
    }),
  });
  const payload = (await response.json().catch(() => ({}))) as GroqResponse;
  if (!response.ok) {
    const error = new Error(payload.error?.message || `Groq request failed (${response.status})`) as Error & { status: number; retryAfterMs?: number };
    error.status = response.status;
    error.retryAfterMs = retryAfterMs(response);
    throw error;
  }
  const choice = payload.choices?.[0];
  const text = choice?.message?.content?.trim() ?? "";
  if (!text) {
    const error = new Error("Groq returned an empty response") as Error & { status: number };
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
    },
  };
}
