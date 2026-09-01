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
import { z } from "zod";

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
  jsonSchema?: AdapterRequest["jsonSchema"];
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
      jsonSchema: params.jsonSchema,
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

function strictProviderSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(strictProviderSchema);
  if (!value || typeof value !== "object") return value;

  const source = value as Record<string, unknown>;
  const output = Object.fromEntries(
    Object.entries(source).map(([key, entry]) => [
      key,
      strictProviderSchema(entry),
    ]),
  );
  if (Array.isArray(output.oneOf)) {
    output.anyOf = output.oneOf;
    delete output.oneOf;
  }
  if (Array.isArray(output.anyOf)) {
    output.anyOf = output.anyOf.flatMap((variant) => {
      if (
        variant &&
        typeof variant === "object" &&
        !Array.isArray(variant) &&
        Object.keys(variant).length === 1 &&
        Array.isArray((variant as Record<string, unknown>).anyOf)
      ) {
        return (variant as { anyOf: unknown[] }).anyOf;
      }
      return [variant];
    });
  }
  if (
    output.type === "object" &&
    output.properties &&
    typeof output.properties === "object" &&
    !Array.isArray(output.properties)
  ) {
    const properties = output.properties as Record<string, unknown>;
    const originallyRequired = new Set(
      Array.isArray(output.required)
        ? output.required.filter(
            (entry): entry is string => typeof entry === "string",
          )
        : [],
    );
    output.properties = Object.fromEntries(
      Object.entries(properties).map(([key, property]) => {
        if (originallyRequired.has(key)) return [key, property];
        const variants =
          property &&
          typeof property === "object" &&
          !Array.isArray(property) &&
          Object.keys(property).length === 1 &&
          Array.isArray((property as Record<string, unknown>).anyOf)
            ? (property as { anyOf: unknown[] }).anyOf
            : [property];
        return [key, { anyOf: [...variants, { type: "null" }] }];
      }),
    );
    output.required = Object.keys(properties);
    output.additionalProperties = false;
  }
  return output;
}

function providerJsonSchema<T>(request: AiStructuredRequest<T>) {
  try {
    const generated = z.toJSONSchema(request.schema) as Record<
      string,
      unknown
    >;
    // Provider schemas do not need the draft declaration and some constrained
    // decoders reject it even though the remaining schema is supported.
    const { $schema: _draft, ...schema } = generated;
    return {
      request: {
        name: `${request.task}_response`,
        schema: strictProviderSchema(schema) as Record<string, unknown>,
      },
      normalizationSchema: schema,
    };
  } catch {
    // Zod refinements that cannot be represented as JSON Schema still retain
    // the existing JSON-object + application validation path.
    return undefined;
  }
}

function matchingObjectSchema(
  value: Record<string, unknown>,
  schema: Record<string, unknown>,
): Record<string, unknown> {
  if (schema.properties && typeof schema.properties === "object") {
    return schema;
  }
  const variants = [schema.anyOf, schema.oneOf]
    .flatMap((entry) => (Array.isArray(entry) ? entry : []))
    .filter(
      (entry): entry is Record<string, unknown> =>
        Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
    );
  return (
    variants.find((variant) => {
      const properties = variant.properties;
      if (!properties || typeof properties !== "object") return false;
      return Object.entries(properties as Record<string, unknown>).every(
        ([key, property]) => {
          const constant =
            property && typeof property === "object"
              ? (property as Record<string, unknown>).const
              : undefined;
          return constant === undefined || value[key] === constant;
        },
      );
    }) ?? schema
  );
}

/** Convert strict-schema nullable placeholders back to omitted optionals. */
function normalizeProviderOptionals(value: unknown, schema: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    return value;
  }
  const schemaObject = schema as Record<string, unknown>;
  if (Array.isArray(value)) {
    return value.map((item) =>
      normalizeProviderOptionals(item, schemaObject.items),
    );
  }
  if (typeof value !== "object") return value;
  const source = value as Record<string, unknown>;
  const effectiveSchema = matchingObjectSchema(source, schemaObject);
  const properties =
    effectiveSchema.properties &&
    typeof effectiveSchema.properties === "object" &&
    !Array.isArray(effectiveSchema.properties)
      ? (effectiveSchema.properties as Record<string, unknown>)
      : {};
  const required = new Set(
    Array.isArray(effectiveSchema.required)
      ? effectiveSchema.required.filter(
          (entry): entry is string => typeof entry === "string",
        )
      : [],
  );
  return Object.fromEntries(
    Object.entries(source).flatMap(([key, entry]) => {
      if (entry === null && !required.has(key)) return [];
      return [[key, normalizeProviderOptionals(entry, properties[key])]];
    }),
  );
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
  // Enable constrained decoding only for contracts whose complete schema has
  // been exercised against Groq's supported subset. Other grading schemas keep
  // their existing application-validation path until individually qualified.
  const jsonSchema =
    request.task === "ielts_coach_chat" ||
    request.task === "ielts_coach_metadata"
      ? providerJsonSchema(request)
      : undefined;
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
          jsonSchema: jsonSchema?.request,
        });
        attempts.push(invocation.attempt);
        let raw: unknown;
        try {
          raw = normalizeProviderOptionals(
            extractJsonObject(invocation.response.text),
            jsonSchema?.normalizationSchema,
          );
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
        // Groq can reject a JSON-mode completion at the API boundary when the
        // generated payload is not valid JSON. That is a known-invalid output,
        // not an ambiguous transport failure, so the bounded schema-repair
        // prompt is safe and materially improves grading reliability. Network,
        // timeout, rate-limit, and provider failures still move directly to the
        // next candidate without spending a repair call.
        if (
          executionError.kind === "schema_invalid" &&
          repair < policy.schemaRepairAttempts
        ) {
          prompt = `${request.prompt}\n\nThe previous response was rejected because it was not valid JSON. Return only one valid JSON object matching the required schema exactly. ${request.repairInstruction || "Do not add markdown or prose."}`;
          continue;
        }
        // A repair prompt is only valid after a provider returned malformed JSON.
        // Transport/provider failures move directly to the next declared candidate.
        break;
      }
    }
    if (!finalError || !isFallbackEligible(finalError.kind)) break;
  }
  throw new AiExecutionError({ message: finalError?.message || "No AI provider produced valid structured output", kind: finalError?.kind || "unknown", retryAfterMs: finalError?.retryAfterMs, attempts, cause: finalError });
}
