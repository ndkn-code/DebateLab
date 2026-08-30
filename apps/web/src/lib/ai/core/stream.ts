import {
  auditProviderAttempt,
  classifyProviderFailure,
} from "./adapters/shared";
import {
  AiExecutionError,
  type AiAttempt,
  type AiExecutionContext,
  type AiTextRequest,
} from "./contracts";
import { getAiTaskPolicy } from "./policies";
import {
  getGeminiApiKeys,
  recordGeminiKeyFailure,
  recordGeminiKeySuccess,
  selectGeminiKeyAttempts,
  shouldTryNextGeminiKey,
} from "@/lib/gemini/key-pool";

type GroqStreamEvent = {
  choices?: Array<{
    delta?: { content?: string | null };
    finish_reason?: string | null;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

type GeminiStreamEvent = {
  candidates?: Array<{
    finishReason?: string | null;
    content?: { parts?: Array<{ text?: string | null }> };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: { message?: string };
};

function streamContext(
  context: AiExecutionContext,
  timeoutMs: number,
): AiExecutionContext & { traceId: string; deadlineAt: number } {
  return {
    ...context,
    traceId: context.traceId || crypto.randomUUID(),
    deadlineAt: context.deadlineAt ?? Date.now() + timeoutMs,
  };
}

function dataEvents(chunk: string) {
  return chunk
    .split("\n")
    .flatMap((line) => (line.startsWith("data: ") ? [line.slice(6)] : []));
}

function geminiPrompt(request: AiTextRequest) {
  return request.messages
    .map((message) => `${message.role.toUpperCase()}:\n${message.content}`)
    .join("\n\n");
}

function isFallbackEligible(kind: AiExecutionError["kind"]) {
  // Text streaming can safely switch candidates only before visible output.
  // At that point even a provider-specific configuration/model error should
  // use the privacy-compatible fallback instead of breaking the coach.
  return Boolean(kind);
}

/**
 * Central streaming path for interactive text. It intentionally only fails over
 * before emitting a token: switching providers after visible text would create
 * a duplicated or contradictory student-facing answer.
 */
export async function* streamText(
  request: AiTextRequest,
): AsyncGenerator<string> {
  const policy = { ...getAiTaskPolicy(request.task), ...request.policy };
  const context = streamContext(
    request.context,
    policy.attemptTimeoutMs * Math.max(1, policy.candidates.length),
  );
  const attempts: AiAttempt[] = [];
  let lastError: AiExecutionError | null = null;

  for (
    let candidateIndex = 0;
    candidateIndex < policy.candidates.length;
    candidateIndex += 1
  ) {
    const candidate = policy.candidates[candidateIndex]!;
    if (candidate.provider === "gemini") {
      const keys = getGeminiApiKeys();
      if (keys.length === 0) {
        lastError = new AiExecutionError({
          message: "GEMINI_API_KEY or GEMINI_API_KEYS is not configured",
          kind: "misconfiguration",
          attempts,
        });
        continue;
      }

      let keyAttempts;
      try {
        keyAttempts = selectGeminiKeyAttempts(
          `${context.traceId}:${candidate.model}`,
        );
      } catch (error) {
        lastError = new AiExecutionError({
          message:
            error instanceof Error
              ? error.message
              : "Gemini key pool is unavailable",
          kind: "provider_unavailable",
          attempts,
          cause: error,
        });
        continue;
      }
      for (const keyAttempt of keyAttempts) {
        const remaining = context.deadlineAt - Date.now();
        if (remaining <= 0) {
          throw new AiExecutionError({
            message: "AI task deadline exceeded",
            kind: "deadline_exceeded",
            attempts,
          });
        }
        const controller = new AbortController();
        const timer = setTimeout(
          () => controller.abort(),
          Math.min(policy.attemptTimeoutMs, remaining),
        );
        const startedAt = Date.now();
        let emitted = false;
        let selected = false;
        let finishReason: string | null = null;
        let usage: GeminiStreamEvent["usageMetadata"] | undefined;
        try {
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(candidate.model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(keys[keyAttempt.slot]!)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              signal: controller.signal,
              body: JSON.stringify({
                contents: [{ parts: [{ text: geminiPrompt(request) }] }],
                generationConfig: {
                  temperature: policy.temperature,
                  maxOutputTokens: policy.maxOutputTokens,
                },
              }),
            },
          );
          if (!response.ok || !response.body) {
            const payload = (await response
              .json()
              .catch(() => ({}))) as GeminiStreamEvent;
            const error = new Error(
              payload.error?.message ||
                `Gemini streaming request failed (${response.status})`,
            ) as Error & { status: number };
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
              const event = JSON.parse(data) as GeminiStreamEvent;
              const text =
                event.candidates?.[0]?.content?.parts
                  ?.map((part) => part.text ?? "")
                  .join("") ?? "";
              if (event.candidates?.[0]?.finishReason) {
                finishReason = event.candidates[0].finishReason;
              }
              if (event.usageMetadata) usage = event.usageMetadata;
              if (text) {
                if (!selected) {
                  request.onProviderSelected?.({
                    provider: "gemini",
                    model: candidate.model,
                    traceId: context.traceId,
                  });
                  selected = true;
                }
                emitted = true;
                yield text;
              }
            }
          }
          if (!emitted) {
            const error = new Error(
              "Gemini returned an empty streaming response",
            ) as Error & { status: number };
            error.status = 503;
            throw error;
          }
          recordGeminiKeySuccess(keyAttempt.slot);
          const latencyMs = Date.now() - startedAt;
          const providerRequestId = await auditProviderAttempt({
            provider: "gemini",
            model: candidate.model,
            status: "success",
            context,
            latencyMs,
            usage: {
              inputTokens: usage?.promptTokenCount,
              outputTokens: usage?.candidatesTokenCount,
              totalTokens: usage?.totalTokenCount,
            },
            responseStatus: response.status,
            finishReason,
            phase: "primary",
            candidateIndex,
          });
          attempts.push({
            provider: "gemini",
            model: candidate.model,
            status: "success",
            latencyMs,
            providerRequestId,
          });
          return;
        } catch (error) {
          const latencyMs = Date.now() - startedAt;
          const kind = controller.signal.aborted
            ? "deadline_exceeded"
            : classifyProviderFailure(error);
          recordGeminiKeyFailure(keyAttempt.slot, error);
          const providerRequestId = await auditProviderAttempt({
            provider: "gemini",
            model: candidate.model,
            status: "error",
            context,
            latencyMs,
            errorCode: kind,
            errorMessage:
              error instanceof Error ? error.message : String(error),
            phase: "primary",
            candidateIndex,
          }).catch(() => null);
          const failedAttempt: AiAttempt = {
            provider: "gemini",
            model: candidate.model,
            status: "error",
            latencyMs,
            failureKind: kind,
            providerRequestId,
          };
          attempts.push(failedAttempt);
          const executionError = new AiExecutionError({
            message:
              error instanceof Error ? error.message : "Coach stream failed",
            kind,
            attempts: [...attempts],
            cause: error,
          });
          if (emitted) throw executionError;
          lastError = executionError;
          if (!shouldTryNextGeminiKey(error) || controller.signal.aborted) {
            break;
          }
        } finally {
          clearTimeout(timer);
        }
      }
      if (lastError && !isFallbackEligible(lastError.kind)) break;
      continue;
    }

    if (candidate.provider !== "groq") continue;
    const apiKey = process.env.GROQ_API_KEY?.trim();
    if (!apiKey) {
      lastError = new AiExecutionError({
        message: "GROQ_API_KEY is not configured",
        kind: "misconfiguration",
        attempts,
      });
      continue;
    }
    const remaining = context.deadlineAt - Date.now();
    if (remaining <= 0)
      throw new AiExecutionError({
        message: "AI task deadline exceeded",
        kind: "deadline_exceeded",
        attempts,
      });
    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      Math.min(policy.attemptTimeoutMs, remaining),
    );
    const startedAt = Date.now();
    let emitted = false;
    let finishReason: string | null = null;
    let usage: GroqStreamEvent["usage"] | undefined;
    try {
      const response = await fetch(
        "https://api.groq.com/openai/v1/chat/completions",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
          body: JSON.stringify({
            model: candidate.model,
            messages: request.messages,
            temperature: policy.temperature,
            max_tokens: policy.maxOutputTokens,
            stream: true,
            stream_options: { include_usage: true },
          }),
        },
      );
      if (!response.ok || !response.body) {
        const message = await response.text().catch(() => "");
        const error = new Error(
          message || `Groq streaming request failed (${response.status})`,
        ) as Error & { status: number };
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
          if (event.choices?.[0]?.finish_reason)
            finishReason = event.choices[0].finish_reason;
          if (event.usage) usage = event.usage;
          if (text) {
            if (!emitted) {
              request.onProviderSelected?.({
                provider: "groq",
                model: candidate.model,
                traceId: context.traceId,
              });
            }
            emitted = true;
            yield text;
          }
        }
      }
      if (!emitted) {
        const error = new Error(
          "Groq returned an empty streaming response",
        ) as Error & { status: number };
        error.status = 503;
        throw error;
      }
      const latencyMs = Date.now() - startedAt;
      const providerRequestId = await auditProviderAttempt({
        provider: "groq",
        model: candidate.model,
        status: "success",
        context,
        latencyMs,
        usage: {
          inputTokens: usage?.prompt_tokens,
          outputTokens: usage?.completion_tokens,
          totalTokens: usage?.total_tokens,
        },
        responseStatus: response.status,
        finishReason,
        phase: "primary",
        candidateIndex,
      });
      attempts.push({
        provider: "groq",
        model: candidate.model,
        status: "success",
        latencyMs,
        providerRequestId,
      });
      return;
    } catch (error) {
      const latencyMs = Date.now() - startedAt;
      const kind = controller.signal.aborted
        ? "deadline_exceeded"
        : classifyProviderFailure(error);
      const providerRequestId = await auditProviderAttempt({
        provider: "groq",
        model: candidate.model,
        status: "error",
        context,
        latencyMs,
        errorCode: kind,
        errorMessage: error instanceof Error ? error.message : String(error),
        phase: "primary",
        candidateIndex,
      }).catch(() => null);
      const executionError = new AiExecutionError({
        message: error instanceof Error ? error.message : "Coach stream failed",
        kind,
        attempts: [
          ...attempts,
          {
            provider: "groq",
            model: candidate.model,
            status: "error",
            latencyMs,
            failureKind: kind,
            providerRequestId,
          },
        ],
        cause: error,
      });
      if (emitted) throw executionError;
      lastError = executionError;
      if (!isFallbackEligible(kind)) break;
    } finally {
      clearTimeout(timer);
    }
  }
  throw (
    lastError ??
    new AiExecutionError({
      message: "No streaming AI provider is configured",
      kind: "misconfiguration",
      attempts,
    })
  );
}
