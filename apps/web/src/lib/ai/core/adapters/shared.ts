import { recordAiProviderRequest } from "@/lib/ai/provider-requests";
import type { AiExecutionContext, AiFailureKind, AiProvider, AiUsage } from "../contracts";

export function configured(value: string | undefined, key: string) {
  if (!value?.trim()) {
    const error = new Error(`${key} is not configured`) as Error & { kind: AiFailureKind };
    error.kind = "misconfiguration";
    throw error;
  }
  return value.trim();
}

export function classifyProviderFailure(error: unknown): AiFailureKind {
  const source = error as { kind?: AiFailureKind; status?: number; code?: number; message?: string };
  if (source?.kind) return source.kind;
  if (error instanceof DOMException && error.name === "AbortError") return "deadline_exceeded";
  const status = source?.status ?? source?.code;
  const message = error instanceof Error ? error.message : String(source?.message ?? error);
  // Groq can reject a JSON-mode completion with HTTP 400 after the model
  // generated malformed JSON. That is an output/schema failure, not a bad
  // caller request, and must remain eligible for the next declared model.
  if (
    status === 400 &&
    /failed to validate json|failed_generation/i.test(message)
  ) {
    return "schema_invalid";
  }
  if (status === 400 || /invalid (request|argument|json|model)/i.test(message)) return "invalid_request";
  if (status === 401 || status === 403 || /api key|unauthenticated|permission denied|forbidden/i.test(message)) return "misconfiguration";
  if (status === 402 || /budget|payment required/i.test(message)) return "budget_exhausted";
  if (status === 408 || status === 504 || /abort|timeout|timed out/i.test(message)) return "deadline_exceeded";
  if (status === 429 || /quota|rate.?limit|too many requests/i.test(message)) return "rate_limited";
  if (status === 500 || status === 502 || status === 503 || /unavailable|overloaded|network|fetch failed|socket|econnreset/i.test(message)) return "provider_unavailable";
  return "unknown";
}

export function retryAfterMs(response: Response) {
  const seconds = Number(response.headers.get("retry-after"));
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1_000 : undefined;
}

export async function auditProviderAttempt(params: {
  provider: AiProvider;
  model: string;
  status: "success" | "error";
  context: AiExecutionContext;
  latencyMs: number;
  usage?: AiUsage;
  responseStatus?: number | null;
  finishReason?: string | null;
  errorCode?: string;
  errorMessage?: string;
  phase: "primary" | "schema_repair";
  candidateIndex: number;
  extraMetadata?: Record<string, unknown>;
}) {
  const label = params.provider === "gemini" ? "google" : params.provider;
  return recordAiProviderRequest({
    provider: label,
    model: params.model,
    status: params.status,
    sourceRoute: params.context.sourceRoute,
    outputType: params.context.outputType,
    userId: params.context.userId ?? undefined,
    requestId: params.context.traceId,
    responseStatus: params.responseStatus ?? undefined,
    finishReason: params.finishReason ?? undefined,
    latencyMs: params.latencyMs,
    usage: params.usage,
    errorCode: params.errorCode,
    errorMessage: params.errorMessage,
    practiceAttemptId: params.context.entity?.practiceAttemptId,
    analysisJobId: params.context.entity?.analysisJobId,
    debateSessionId: params.context.entity?.debateSessionId,
    metadata: {
      traceId: params.context.traceId,
      idempotencyKey: params.context.idempotencyKey ?? null,
      aiTask: params.context.task,
      phase: params.phase,
      candidateIndex: params.candidateIndex,
      speakingResponseId: params.context.entity?.speakingResponseId ?? null,
      writingResponseId: params.context.entity?.writingResponseId ?? null,
      ...(params.context.metadata ?? {}),
      ...(params.extraMetadata ?? {}),
    },
  });
}

export function messageText(messages: Array<{ role: string; content: string }>) {
  return messages.map((message) => `${message.role.toUpperCase()}:\n${message.content}`).join("\n\n");
}
