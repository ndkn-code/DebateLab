import { auditProviderAttempt, classifyProviderFailure } from "./adapters/shared";
import { AiExecutionError, type AiAttempt, type AiExecutionContext, type AiTextRequest } from "./contracts";
import { getAiTaskPolicy } from "./policies";

type GroqStreamEvent = {
  choices?: Array<{ delta?: { content?: string | null }; finish_reason?: string | null }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
};

function streamContext(context: AiExecutionContext, timeoutMs: number): AiExecutionContext & { traceId: string; deadlineAt: number } {
  return {
    ...context,
    traceId: context.traceId || crypto.randomUUID(),
    deadlineAt: context.deadlineAt ?? Date.now() + timeoutMs,
  };
}

function dataEvents(chunk: string) {
  return chunk.split("\n").flatMap((line) => line.startsWith("data: ") ? [line.slice(6)] : []);
}

/**
 * Central streaming path for interactive text. It intentionally only fails over
 * before emitting a token: switching providers after visible text would create
 * a duplicated or contradictory student-facing answer.
 */
export async function* streamText(request: AiTextRequest): AsyncGenerator<string> {
  const policy = { ...getAiTaskPolicy(request.task), ...request.policy };
  const context = streamContext(request.context, policy.attemptTimeoutMs * Math.max(1, policy.candidates.length));
  const attempts: AiAttempt[] = [];
  let lastError: AiExecutionError | null = null;

  for (let candidateIndex = 0; candidateIndex < policy.candidates.length; candidateIndex += 1) {
    const candidate = policy.candidates[candidateIndex]!;
    if (candidate.provider !== "groq") continue;
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) {
      lastError = new AiExecutionError({ message: "GROQ_API_KEY is not configured", kind: "misconfiguration", attempts });
      continue;
    }
    const remaining = context.deadlineAt - Date.now();
    if (remaining <= 0) throw new AiExecutionError({ message: "AI task deadline exceeded", kind: "deadline_exceeded", attempts });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(policy.attemptTimeoutMs, remaining));
    const startedAt = Date.now();
    let emitted = false;
    let finishReason: string | null = null;
    let usage: GroqStreamEvent["usage"] | undefined;
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: candidate.model,
          messages: request.messages,
          temperature: policy.temperature,
          max_tokens: policy.maxOutputTokens,
          stream: true,
          stream_options: { include_usage: true },
        }),
      });
      if (!response.ok || !response.body) {
        const message = await response.text().catch(() => "");
        const error = new Error(message || `Groq streaming request failed (${response.status})`) as Error & { status: number };
        error.status = response.status;
        throw error;
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        buffer += decoder.decode(next.value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const data of dataEvents(lines.join("\n"))) {
          if (data === "[DONE]") continue;
          const event = JSON.parse(data) as GroqStreamEvent;
          const text = event.choices?.[0]?.delta?.content ?? "";
          if (event.choices?.[0]?.finish_reason) finishReason = event.choices[0].finish_reason;
          if (event.usage) usage = event.usage;
          if (text) {
            emitted = true;
            yield text;
          }
        }
      }
      const latencyMs = Date.now() - startedAt;
      const providerRequestId = await auditProviderAttempt({
        provider: "groq", model: candidate.model, status: "success", context, latencyMs,
        usage: { inputTokens: usage?.prompt_tokens, outputTokens: usage?.completion_tokens, totalTokens: usage?.total_tokens },
        responseStatus: response.status, finishReason, phase: "primary", candidateIndex,
      });
      attempts.push({ provider: "groq", model: candidate.model, status: "success", latencyMs, providerRequestId });
      return;
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      const kind = controller.signal.aborted ? "deadline_exceeded" : classifyProviderFailure(error);
      const providerRequestId = await auditProviderAttempt({
        provider: "groq", model: candidate.model, status: "error", context, latencyMs,
        errorCode: kind, errorMessage: error instanceof Error ? error.message : String(error), phase: "primary", candidateIndex,
      }).catch(() => null);
      const executionError = new AiExecutionError({
        message: error instanceof Error ? error.message : "Coach stream failed", kind,
        attempts: [...attempts, { provider: "groq", model: candidate.model, status: "error", latencyMs, failureKind: kind, providerRequestId }], cause: error,
      });
      if (emitted) throw executionError;
      lastError = executionError;
      if (kind !== "rate_limited" && kind !== "provider_unavailable" && kind !== "deadline_exceeded") break;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError ?? new AiExecutionError({ message: "No streaming AI provider is configured", kind: "misconfiguration", attempts });
}
