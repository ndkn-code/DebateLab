import { requiredEnvironment, type OpsMcpEnvironment } from "./config.js";
import {
  syntheticSmokeResultSchema,
  type SyntheticSmokeResult,
} from "./contracts.js";

export type SyntheticModel = "qwen" | "gpt-oss";

const MODEL_IDS = {
  qwen: "qwen/qwen3.8-27b",
  "gpt-oss": "openai/gpt-oss-120b",
} as const;

const FIXED_SYNTHETIC_MESSAGES = [
  {
    role: "system",
    content: "This is a synthetic availability probe. Reply with exactly OK.",
  },
  { role: "user", content: "Synthetic health check: respond OK." },
] as const;

export async function runSyntheticModelSmoke(
  model: SyntheticModel,
  environment: OpsMcpEnvironment = process.env,
  fetcher: typeof fetch = fetch,
): Promise<SyntheticSmokeResult> {
  const apiKey = requiredEnvironment(environment, "GROQ_API_KEY");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  const startedAt = Date.now();
  try {
    const response = await fetcher(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: MODEL_IDS[model],
          messages: FIXED_SYNTHETIC_MESSAGES,
          temperature: 0,
          max_completion_tokens: 8,
        }),
        signal: controller.signal,
      },
    );
    let usage: Record<string, unknown> = {};
    let schemaValid = false;
    if (response.ok) {
      const body = (await response.json()) as Record<string, unknown>;
      if (body.usage && typeof body.usage === "object") {
        usage = body.usage as Record<string, unknown>;
      }
      const choices = Array.isArray(body.choices) ? body.choices : [];
      const first = choices[0] as
        | { message?: { content?: unknown } }
        | undefined;
      schemaValid = first?.message?.content?.toString().trim() === "OK";
    } else {
      // Drain the response without retaining or returning provider content.
      await response.arrayBuffer().catch(() => undefined);
    }
    return syntheticSmokeResultSchema.parse({
      model,
      modelId: MODEL_IDS[model],
      success: response.ok && schemaValid,
      responseStatus: response.status,
      latencyMs: Math.max(0, Date.now() - startedAt),
      inputTokens:
        typeof usage.prompt_tokens === "number" ? usage.prompt_tokens : null,
      outputTokens:
        typeof usage.completion_tokens === "number"
          ? usage.completion_tokens
          : null,
    });
  } finally {
    clearTimeout(timeout);
  }
}
