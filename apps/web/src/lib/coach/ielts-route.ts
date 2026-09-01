import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

import { getPostHogServer } from "@/lib/posthog-server";
import type { Database, Json } from "@/types/supabase";
import { AiExecutionError } from "@/lib/ai/core";
import {
  CoachContextBoundaryError,
  resolveCoachConversationContext,
} from "./ielts-context";
import {
  IELTS_COACH_PROMPT_VERSION,
  ieltsCoachTerminalErrorSchema,
} from "./ielts-contract";
import { IeltsCoachRuntimeError, runIeltsCoachTurn } from "./ielts-runtime";
import type {
  IeltsCoachApiRequest,
  IeltsCoachResponseMetadata,
} from "./ielts-api-contract";

export { ieltsCoachContextTypeSchema } from "./ielts-api-contract";
export type { IeltsCoachApiRequest } from "./ielts-api-contract";

export interface IeltsCoachRouteDependencies {
  runTurn?: typeof runIeltsCoachTurn;
  capture?: (event: {
    distinctId: string;
    event: string;
    properties: Record<string, unknown>;
  }) => void;
}

const claimSchema = z.discriminatedUnion("outcome", [
  z.object({
    outcome: z.literal("claimed"),
    turnId: z.string().uuid(),
    attemptCount: z.number().int().min(1).max(2),
    claimToken: z.string().uuid(),
  }),
  z.object({
    outcome: z.literal("lease_active"),
    turnId: z.string().uuid(),
    attemptCount: z.number().int().min(1).max(2),
  }),
  z.object({
    outcome: z.literal("completed"),
    turnId: z.string().uuid(),
    responseText: z.string(),
    responseMetadata: z.record(z.string(), z.unknown()),
    assistantMessageId: z.string().uuid().nullable(),
    attemptCount: z.number().int().min(1).max(2),
  }),
  z.object({
    outcome: z.literal("exhausted"),
    turnId: z.string().uuid(),
    attemptCount: z.number().int().min(2),
    errorCode: z.string(),
  }),
]);

interface RpcError {
  message: string;
}

class IeltsCoachInfrastructureError extends Error {
  constructor() {
    super("IELTS_COACH_INFRASTRUCTURE_UNAVAILABLE");
    this.name = "IeltsCoachInfrastructureError";
  }
}

interface CoachRpcClient {
  rpc(
    name: string,
    args: Record<string, unknown>,
  ): Promise<{ data: unknown; error: RpcError | null }>;
}

function rpcClient(supabase: SupabaseClient) {
  return supabase as unknown as CoachRpcClient;
}

async function requestHash(request: IeltsCoachApiRequest) {
  const payload = JSON.stringify({
    message: request.message.trim(),
    locale: request.locale,
    contextType: request.contextType,
    contextId: request.contextId ?? null,
  });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(payload),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function jsonResponse(value: unknown, status: number) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function sseResponse(params: {
  text: string;
  conversationId: string;
  assistantMessageId: string | null;
  metadata: Record<string, unknown> | IeltsCoachResponseMetadata;
}) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            text: params.text,
            conversationId: params.conversationId,
            productContext: "ielts",
          })}\n\n`,
        ),
      );
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({
            done: true,
            conversationId: params.conversationId,
            assistantMessageId: params.assistantMessageId,
            productContext: "ielts",
            metadata: params.metadata,
          })}\n\n`,
        ),
      );
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

async function resolveConversation(params: {
  supabase: SupabaseClient<Database>;
  userId: string;
  request: IeltsCoachApiRequest;
}) {
  if (!params.request.conversationId) {
    const ensured = await rpcClient(params.supabase).rpc(
      "ensure_ielts_coach_conversation",
      {
        p_client_request_id: params.request.requestId,
        p_context_type: params.request.contextType,
        p_context_id: params.request.contextId ?? null,
        p_title:
          params.request.locale === "vi"
            ? "Cuộc hội thoại IELTS mới"
            : "New IELTS conversation",
      },
    );
    if (ensured.error || typeof ensured.data !== "string") {
      if (ensured.error?.message.includes("identity mismatch")) {
        throw new CoachContextBoundaryError("COACH_CONTEXT_MISMATCH");
      }
      throw new IeltsCoachInfrastructureError();
    }
    return ensured.data;
  }

  const existing = await params.supabase
    .from("chat_conversations")
    .select("id, product_context, context_type, context_id")
    .eq("id", params.request.conversationId)
    .eq("user_id", params.userId)
    .maybeSingle();
  if (existing.error || !existing.data) {
    throw new CoachContextBoundaryError("COACH_CONTEXT_MISMATCH");
  }
  resolveCoachConversationContext({
    requested: { product: "ielts", subject: "ielts" },
    persisted: {
      product:
        existing.data.product_context === "ielts" ||
        existing.data.product_context === "debate"
          ? existing.data.product_context
          : null,
      subject:
        existing.data.product_context === "ielts" ||
        existing.data.product_context === "debate"
          ? existing.data.product_context
          : null,
    },
  });
  if (
    existing.data.context_type !== params.request.contextType ||
    (existing.data.context_id ?? undefined) !== params.request.contextId
  ) {
    throw new CoachContextBoundaryError("COACH_CONTEXT_MISMATCH");
  }
  return existing.data.id;
}

function safeErrorCode(error: unknown) {
  if (error instanceof IeltsCoachRuntimeError) return error.code;
  if (error instanceof IeltsCoachInfrastructureError) {
    return "IELTS_COACH_INFRASTRUCTURE_UNAVAILABLE" as const;
  }
  return "IELTS_COACH_PROVIDER_UNAVAILABLE" as const;
}

export async function handleIeltsCoachRequest(params: {
  supabase: SupabaseClient<Database>;
  trustedSupabase: SupabaseClient<Database>;
  userId: string;
  request: IeltsCoachApiRequest;
  dependencies?: IeltsCoachRouteDependencies;
}): Promise<Response> {
  let turnId: string | null = null;
  let claimToken: string | null = null;
  let attempt = 1;
  const startedAt = Date.now();
  const stageLatency: Partial<
    Record<
      "conversation" | "claim" | "history" | "generation" | "persistence",
      number
    >
  > = {};
  try {
    let stageStartedAt = Date.now();
    const conversationId = await resolveConversation(params);
    stageLatency.conversation = Date.now() - stageStartedAt;
    const historyStartedAt = Date.now();
    const historyPromise = Promise.resolve(
      params.supabase
        .from("chat_messages")
        .select("role, content")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: false })
        .limit(12),
    ).then((result) => ({
      result,
      latencyMs: Date.now() - historyStartedAt,
    }));
    stageStartedAt = Date.now();
    const claimedResult = await rpcClient(params.trustedSupabase).rpc(
      "claim_ai_coach_turn",
      {
        p_user_id: params.userId,
        p_conversation_id: conversationId,
        p_client_request_id: params.request.requestId,
        p_product_context: "ielts",
        p_request_hash: await requestHash(params.request),
        p_lease_seconds: 90,
      },
    );
    stageLatency.claim = Date.now() - stageStartedAt;
    if (claimedResult.error) {
      if (claimedResult.error.message.includes("identity mismatch")) {
        throw new CoachContextBoundaryError("COACH_CONTEXT_MISMATCH");
      }
      throw new IeltsCoachInfrastructureError();
    }
    const claim = claimSchema.parse(claimedResult.data);
    turnId = claim.turnId;
    attempt = claim.attemptCount;

    if (claim.outcome === "completed") {
      return sseResponse({
        text: claim.responseText,
        conversationId,
        assistantMessageId: claim.assistantMessageId,
        metadata: claim.responseMetadata,
      });
    }
    if (claim.outcome === "lease_active") {
      return jsonResponse(
        {
          status: "processing",
          code: "IELTS_COACH_IN_PROGRESS",
          runId: claim.turnId,
          requestId: params.request.requestId,
          retryAfterSeconds: 3,
        },
        409,
      );
    }
    if (claim.outcome === "exhausted") {
      return jsonResponse(
        ieltsCoachTerminalErrorSchema.parse({
          status: "terminal",
          code: "IELTS_COACH_RETRY_EXHAUSTED",
          runId: claim.turnId,
          userMessage:
            params.request.locale === "vi"
              ? "Coach chưa thể hoàn tất yêu cầu này. Hãy bắt đầu một câu hỏi mới."
              : "The Coach could not complete this request. Please start a new question.",
          attempt: claim.attemptCount,
          maxAttempts: 2,
          manualRetry: {
            allowed: false,
            idempotencyKey: null,
            availableAt: null,
          },
        }),
        503,
      );
    }
    claimToken = claim.claimToken;

    const { result: historyResult, latencyMs: historyLatencyMs } =
      await historyPromise;
    if (historyResult.error) throw historyResult.error;
    const history: Array<{
      role: "user" | "assistant";
      content: string;
    }> = [];
    for (const historyMessage of [...(historyResult.data ?? [])].reverse()) {
      if (
        (historyMessage.role === "user" ||
          historyMessage.role === "assistant") &&
        typeof historyMessage.content === "string"
      ) {
        history.push({
          role: historyMessage.role,
          content: historyMessage.content,
        });
      }
    }
    stageLatency.history = historyLatencyMs;

    stageStartedAt = Date.now();
    const result = await (params.dependencies?.runTurn ?? runIeltsCoachTurn)({
      supabase: params.supabase,
      userId: params.userId,
      conversationId,
      requestId: params.request.requestId,
      locale: params.request.locale,
      message: params.request.message,
      history,
      googleAiConsent: params.request.googleAiConsent,
    });
    stageLatency.generation = Date.now() - stageStartedAt;
    const metadata: IeltsCoachResponseMetadata = {
      contractVersion: "ielts-coach-response.v1",
      productContext: "ielts",
      runId: turnId,
      requestId: params.request.requestId,
      promptVersion: result.promptVersion,
      rubricVersion: result.rubricVersion,
      coach: result.output,
      evidenceReferences: result.output.sources,
      confidence: result.output.confidence,
    };
    stageStartedAt = Date.now();
    const completed = await rpcClient(params.trustedSupabase).rpc(
      "complete_ai_coach_turn",
      {
        p_user_id: params.userId,
        p_turn_id: turnId,
        p_claim_token: claimToken,
        p_attempt_count: attempt,
        p_user_message: params.request.message,
        p_assistant_message: result.text,
        p_response_metadata: metadata as unknown as Json,
      },
    );
    if (completed.error) throw new Error(completed.error.message);
    const assistantMessageId = z
      .object({ assistantMessageId: z.string().uuid().nullable() })
      .parse(completed.data).assistantMessageId;
    stageLatency.persistence = Date.now() - stageStartedAt;

    const capture =
      params.dependencies?.capture ??
      ((event: Parameters<ReturnType<typeof getPostHogServer>["capture"]>[0]) =>
        getPostHogServer().capture(event));
    capture({
      distinctId: params.userId,
      event: "$ai_generation",
      properties: {
        $ai_provider: result.provider,
        $ai_model: result.model,
        $ai_latency: result.latencyMs,
        $ai_input_tokens: result.usage?.inputTokens,
        $ai_output_tokens: result.usage?.outputTokens,
        $ai_is_error: false,
        $ai_trace_id: result.traceId,
        route: "/api/chat",
        product_context: "ielts",
        prompt_version: result.promptVersion,
        rubric_version: result.rubricVersion,
        fallback_used: result.fallbackUsed,
        conversation_latency_ms: stageLatency.conversation,
        claim_latency_ms: stageLatency.claim,
        history_latency_ms: stageLatency.history,
        generation_stage_latency_ms: stageLatency.generation,
        persistence_latency_ms: stageLatency.persistence,
        total_latency_ms: Date.now() - startedAt,
      },
    });
    capture({
      distinctId: params.userId,
      event: "ielts_ai_coach_recommended_task",
      properties: {
        recommendation_id: turnId,
        task_id: result.output.recommendedTask.taskId,
        skill: result.output.diagnosis.skill,
        criterion: result.output.bandCriterionGap.criterion,
        outcome: result.output.outcome,
        prompt_version: result.promptVersion,
        rubric_version: result.rubricVersion,
        latency_ms: Date.now() - startedAt,
        conversation_latency_ms: stageLatency.conversation,
        claim_latency_ms: stageLatency.claim,
        history_latency_ms: stageLatency.history,
        generation_stage_latency_ms: stageLatency.generation,
        persistence_latency_ms: stageLatency.persistence,
      },
    });
    return sseResponse({
      text: result.text,
      conversationId,
      assistantMessageId,
      metadata,
    });
  } catch (error) {
    console.error("IELTS Coach request failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      message: error instanceof Error ? error.message : "Unknown failure",
    });
    const runtimeError = error instanceof IeltsCoachRuntimeError ? error : null;
    if (turnId && claimToken) {
      await rpcClient(params.trustedSupabase).rpc("fail_ai_coach_turn", {
        p_user_id: params.userId,
        p_turn_id: turnId,
        p_claim_token: claimToken,
        p_attempt_count: attempt,
        p_error_code: safeErrorCode(error),
      });
    }
    const executionCause =
      error instanceof IeltsCoachRuntimeError &&
      error.cause instanceof AiExecutionError
        ? error.cause
        : null;
    const lastAttempt = executionCause?.attempts.at(-1);
    (
      params.dependencies?.capture ??
      ((event: Parameters<ReturnType<typeof getPostHogServer>["capture"]>[0]) =>
        getPostHogServer().capture(event))
    )({
      distinctId: params.userId,
      event: "$ai_generation",
      properties: {
        $ai_provider: lastAttempt?.provider ?? "not_started",
        $ai_model: lastAttempt?.model ?? "not_started",
        $ai_latency: Date.now() - startedAt,
        $ai_is_error: true,
        route: "/api/chat",
        product_context: "ielts",
        prompt_version: IELTS_COACH_PROMPT_VERSION,
        rubric_version: "public-ielts-rubric-v1",
        failure_code: safeErrorCode(error),
        attempt,
        conversation_latency_ms: stageLatency.conversation,
        claim_latency_ms: stageLatency.claim,
        history_latency_ms: stageLatency.history,
        generation_stage_latency_ms: stageLatency.generation,
        persistence_latency_ms: stageLatency.persistence,
      },
    });
    const retryable =
      error instanceof CoachContextBoundaryError
        ? false
        : (runtimeError?.retryable ?? true);
    const maxAttempts = retryable ? 2 : attempt;
    const manualRetryAllowed = retryable && attempt < maxAttempts;
    return jsonResponse(
      ieltsCoachTerminalErrorSchema.parse({
        status: "terminal",
        code:
          error instanceof CoachContextBoundaryError
            ? "IELTS_COACH_CONTEXT_BLOCKED"
            : safeErrorCode(error),
        runId: turnId ?? params.request.requestId,
        userMessage:
          params.request.locale === "vi"
            ? manualRetryAllowed
              ? "Coach gặp lỗi tạm thời. Bạn có thể thử lại an toàn."
              : "Coach không thể dùng ngữ cảnh này. Hãy mở đúng khu vực IELTS và thử một câu hỏi mới."
            : manualRetryAllowed
              ? "The Coach hit a temporary problem. You can retry safely."
              : "The Coach cannot use this context. Open the IELTS area and start a new question.",
        attempt,
        maxAttempts,
        manualRetry: {
          allowed: manualRetryAllowed,
          idempotencyKey: manualRetryAllowed ? params.request.requestId : null,
          availableAt: manualRetryAllowed ? new Date().toISOString() : null,
        },
      }),
      error instanceof CoachContextBoundaryError ? 409 : 503,
    );
  }
}
