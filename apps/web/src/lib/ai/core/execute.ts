import { auditProviderAttempt, classifyProviderFailure } from "./adapters/shared";
import { generateDeepSeek } from "./adapters/deepseek";
import { generateGemini } from "./adapters/gemini";
import { generateGroq } from "./adapters/groq";
import type { AdapterRequest, AdapterResponse } from "./adapters/types";
import {
  AiExecutionError,
  type AiAttempt,
  type AiExecutionContext,
  type AiModelCandidate,
  type AiResult,
  type AiStructuredRequest,
  type AiTaskPolicy,
  type AiTextRequest,
} from "./contracts";
import { extractJsonObject } from "./json";
import { getAiTaskPolicy } from "./policies";

function resolvePolicy(task: AiTextRequest["task"], override?: Partial<AiTaskPolicy>): AiTaskPolicy {
  return { ...getAiTaskPolicy(task), ...override };
}

function withTrace(context: AiExecutionContext, policy: AiTaskPolicy, structured = false): AiExecutionContext & { traceId: string } {
  const budgetMs = policy.attemptTimeoutMs * Math.max(
    1,
    structured
      ? policy.candidates.length * (policy.schemaRepairAttempts + 1)
      : policy.candidates.length,
  );
  return { ...context, traceId: context.traceId || crypto.randomUUID(), deadlineAt: context.deadlineAt ?? Date.now() + budgetMs };
}

function remainingTimeoutMs(context: AiExecutionContext, configuredMs: number) {
  if (!context.deadlineAt) return configuredMs;
  const remaining = context.deadlineAt - Date.now();
  if (remaining <= 0) {
    throw new AiExecutionError({ message: "AI task deadline exceeded before provider call", kind: "deadline_exceeded" });
  }
  return Math.max(1, Math.min(configuredMs, remaining));
}

function isFallbackEligible(kind: AiExecutionError["kind"]) {
  return kind === "rate_limited" || kind === "provider_unavailable" || kind === "deadline_exceeded" || kind === "schema_invalid";
}

/**
 * Durable workflow accounting is deliberately best-effort: a telemetry/RPC
 * outage must never turn a model response into a failed learner workflow.
 * Import lazily so the core remains usable outside the durable workflow graph.
 */
async function countWorkflowProviderAttempt(context: AiExecutionContext) {
  const workflowRunId = context.metadata?.workflowRunId;
  if (typeof workflowRunId !== "string" || !workflowRunId) return;
  await import("@/lib/ai/workflow-runs")
    .then(({ incrementAiWorkflowProviderAttempt }) =>
      incrementAiWorkflowProviderAttempt(workflowRunId)
    )
    .catch(() => undefined);
}

async function invoke(params: {
  candidate: AiModelCandidate;
  messages: AdapterRequest["messages"];
  context: AiExecutionContext & { traceId: string };
  policy: AiTaskPolicy;
  phase: "primary" | "schema_repair";
  candidateIndex: number;
  responseFormat: "json" | "text";
}): Promise<{ response: AdapterResponse; attempt: AiAttempt }> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeoutMs = remainingTimeoutMs(params.context, params.policy.attemptTimeoutMs);
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Count once for this declared provider invocation, before it is made. A
    // schema repair or fallback is a separate invocation and receives its own
    // durable-workflow cost observation.
    await countWorkflowProviderAttempt(params.context);
    const request: AdapterRequest = {
      provider: params.candidate.provider,
      model: params.candidate.model,
      messages: params.messages,
      temperature: params.policy.temperature,
      maxOutputTokens: params.policy.maxOutputTokens,
      responseFormat: params.responseFormat,
      signal: controller.signal,
      context: params.context,
      phase: params.phase,
    };
    const response = await (params.candidate.provider === "gemini"
      ? generateGemini(request)
      : params.candidate.provider === "groq"
        ? generateGroq(request)
        : generateDeepSeek(request));
    const latencyMs = Date.now() - startedAt;
    return {
      response,
      attempt: { provider: params.candidate.provider, model: params.candidate.model, status: "success", latencyMs },
    };
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const kind = controller.signal.aborted ? "deadline_exceeded" : classifyProviderFailure(error);
    const retryAfterMs = (error as { retryAfterMs?: number } | null)?.retryAfterMs;
    const providerRequestId = await auditProviderAttempt({
      provider: params.candidate.provider,
      model: params.candidate.model,
      status: "error",
      context: params.context,
      latencyMs,
      errorCode: kind,
      errorMessage: error instanceof Error ? error.message : String(error),
      phase: params.phase,
      candidateIndex: params.candidateIndex,
    }).catch(() => null);
    throw new AiExecutionError({
      message: error instanceof Error ? error.message : "AI provider call failed",
      kind,
      retryAfterMs,
      attempts: [{ provider: params.candidate.provider, model: params.candidate.model, status: "error", latencyMs, failureKind: kind, providerRequestId }],
      cause: error,
    });
  } finally {
    clearTimeout(timer);
  }
}

function result<T>(params: {
  output: T;
  text: string;
  candidate: AiModelCandidate;
  response: AdapterResponse;
  context: AiExecutionContext & { traceId: string };
  attempts: AiAttempt[];
  startedAt: number;
  candidateIndex: number;
}): AiResult<T> {
  return {
    output: params.output,
    text: params.text,
    provider: params.candidate.provider,
    model: params.candidate.model,
    usage: params.response.usage,
    latencyMs: Date.now() - params.startedAt,
    traceId: params.context.traceId,
    fallbackUsed: params.candidateIndex > 0,
    attempts: params.attempts,
    providerRequestIds: params.attempts.flatMap((attempt) => attempt.providerRequestId ? [attempt.providerRequestId] : []),
  };
}

async function auditValidatedSuccess(params: {
  invocation: { response: AdapterResponse; attempt: AiAttempt };
  candidate: AiModelCandidate;
  context: AiExecutionContext & { traceId: string };
  phase: "primary" | "schema_repair";
  candidateIndex: number;
}) {
  params.invocation.attempt.providerRequestId = await auditProviderAttempt({
    provider: params.candidate.provider,
    model: params.candidate.model,
    status: "success",
    context: params.context,
    latencyMs: params.invocation.attempt.latencyMs,
    usage: params.invocation.response.usage,
    responseStatus: params.invocation.response.responseStatus,
    finishReason: params.invocation.response.finishReason,
    phase: params.phase,
    candidateIndex: params.candidateIndex,
  });
}

async function auditSchemaInvalid(params: {
  invocation: { response: AdapterResponse; attempt: AiAttempt };
  candidate: AiModelCandidate;
  context: AiExecutionContext & { traceId: string };
  phase: "primary" | "schema_repair";
  candidateIndex: number;
  error: unknown;
}) {
  await auditProviderAttempt({
    provider: params.candidate.provider,
    model: params.candidate.model,
    status: "error",
    context: params.context,
    latencyMs: params.invocation.attempt.latencyMs,
    responseStatus: params.invocation.response.responseStatus,
    finishReason: params.invocation.response.finishReason,
    errorCode: "schema_invalid",
    errorMessage: params.error instanceof Error ? params.error.message : String(params.error),
    phase: params.phase,
    candidateIndex: params.candidateIndex,
  }).catch(() => null);
}

export async function generateText(request: AiTextRequest): Promise<AiResult<string>> {
  const policy = resolvePolicy(request.task, request.policy);
  const context = withTrace(request.context, policy);
  const startedAt = Date.now();
  const attempts: AiAttempt[] = [];
  let finalError: AiExecutionError | null = null;
  for (let index = 0; index < policy.candidates.length; index += 1) {
    const candidate = policy.candidates[index]!;
    try {
      const invocation = await invoke({ candidate, messages: request.messages, context, policy, phase: "primary", candidateIndex: index, responseFormat: "text" });
      await auditValidatedSuccess({ invocation, candidate, context, phase: "primary", candidateIndex: index });
      attempts.push(invocation.attempt);
      return result({ output: invocation.response.text, text: invocation.response.text, candidate, response: invocation.response, context, attempts, startedAt, candidateIndex: index });
    } catch (error) {
      const executionError = error as AiExecutionError;
      attempts.push(...executionError.attempts);
      finalError = executionError;
      if (!isFallbackEligible(executionError.kind)) break;
    }
  }
  throw new AiExecutionError({ message: finalError?.message || "No AI provider completed the task", kind: finalError?.kind || "unknown", retryAfterMs: finalError?.retryAfterMs, attempts, cause: finalError });
}

export async function generateStructured<T>(request: AiStructuredRequest<T>): Promise<AiResult<T>> {
  const policy = resolvePolicy(request.task, request.policy);
  const context = withTrace(request.context, policy, true);
  const startedAt = Date.now();
  const attempts: AiAttempt[] = [];
  let finalError: AiExecutionError | null = null;
  for (let index = 0; index < policy.candidates.length; index += 1) {
    const candidate = policy.candidates[index]!;
    let prompt = request.prompt;
    for (let repair = 0; repair <= policy.schemaRepairAttempts; repair += 1) {
      try {
        const messages = request.messages
          ? request.messages.map((message, messageIndex, all) =>
              message.role === "user" && messageIndex === all.map((item) => item.role).lastIndexOf("user") && repair > 0
                ? { ...message, content: `${message.content}\n\n${prompt.slice(request.prompt.length)}` }
                : message
            )
          : [{ role: "user" as const, content: prompt }];
        const invocation = await invoke({
          candidate,
          messages,
          context,
          policy,
          phase: repair === 0 ? "primary" : "schema_repair",
          candidateIndex: index,
          responseFormat: "json",
        });
        attempts.push(invocation.attempt);
        let raw: unknown;
        try {
          raw = extractJsonObject(invocation.response.text);
        } catch (error) {
          await auditSchemaInvalid({ invocation, candidate, context, phase: repair === 0 ? "primary" : "schema_repair", candidateIndex: index, error });
          finalError = new AiExecutionError({ message: error instanceof Error ? error.message : "Model response was invalid JSON", kind: "schema_invalid", attempts });
          if (repair === policy.schemaRepairAttempts) break;
          prompt = `${request.prompt}\n\nThe previous response was invalid JSON. Return only one valid JSON object matching the required schema exactly. ${request.repairInstruction || "Do not add markdown or prose."}`;
          continue;
        }
        const parsed = request.schema.safeParse(raw);
        if (parsed.success) {
          await auditValidatedSuccess({ invocation, candidate, context, phase: repair === 0 ? "primary" : "schema_repair", candidateIndex: index });
          return result({ output: parsed.data, text: invocation.response.text, candidate, response: invocation.response, context, attempts, startedAt, candidateIndex: index });
        }
        await auditSchemaInvalid({ invocation, candidate, context, phase: repair === 0 ? "primary" : "schema_repair", candidateIndex: index, error: parsed.error });
        finalError = new AiExecutionError({ message: `Model response failed ${request.task} schema validation: ${parsed.error.issues[0]?.message || "invalid output"}`, kind: "schema_invalid", attempts });
        if (repair === policy.schemaRepairAttempts) break;
        prompt = `${request.prompt}\n\nThe previous response was invalid. Return only a valid JSON object matching the required schema exactly. ${request.repairInstruction || "Do not add markdown or prose."}`;
      } catch (error) {
        const executionError = error as AiExecutionError;
        attempts.push(...executionError.attempts);
        finalError = executionError;
        // A repair prompt is only valid after a provider returned malformed JSON.
        // Transport/provider failures move directly to the next declared candidate.
        break;
      }
    }
    if (!finalError || !isFallbackEligible(finalError.kind)) break;
  }
  throw new AiExecutionError({ message: finalError?.message || "No AI provider produced valid structured output", kind: finalError?.kind || "unknown", retryAfterMs: finalError?.retryAfterMs, attempts, cause: finalError });
}
