import type { SupabaseClient } from "@supabase/supabase-js";
import { estimateAiCostUsd, type AiQualityTokenUsage } from "@/lib/ai/quality-model";

function clampInt(value: number | null | undefined, min = 0) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(min, Math.round(value));
}

function truncate(value: string | null | undefined, max: number) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

export type AiProviderRequestStatus = "success" | "error";

export interface AiProviderRequestInput {
  provider: string;
  model: string;
  status: AiProviderRequestStatus;
  sourceRoute?: string | null;
  outputType?: string | null;
  userId?: string | null;
  requestId?: string | null;
  responseStatus?: number | null;
  finishReason?: string | null;
  latencyMs?: number | null;
  usage?: AiQualityTokenUsage;
  errorCode?: string | null;
  errorMessage?: string | null;
  practiceAttemptId?: string | null;
  analysisJobId?: string | null;
  debateSessionId?: string | null;
  aiQualityRunId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordAiProviderRequest(
  input: AiProviderRequestInput,
  supabase?: SupabaseClient | null
) {
  const client =
    supabase === undefined ? await safelyGetDefaultProviderRequestClient() : supabase;
  if (!client) return null;
  const usage = input.usage ?? {};
  try {
    const { data, error } = await client
      .from("ai_provider_requests")
      .insert({
        provider: input.provider,
        model: input.model,
        status: input.status,
        source_route: input.sourceRoute ?? null,
        output_type: input.outputType ?? null,
        user_id: input.userId ?? null,
        request_id: input.requestId ?? null,
        response_status: clampInt(input.responseStatus),
        finish_reason: truncate(input.finishReason, 100),
        latency_ms: clampInt(input.latencyMs),
        input_tokens: clampInt(usage.inputTokens),
        output_tokens: clampInt(usage.outputTokens),
        total_tokens: clampInt(usage.totalTokens),
        cache_hit_tokens: clampInt(usage.cacheHitTokens),
        cache_miss_tokens: clampInt(usage.cacheMissTokens),
        reasoning_tokens: clampInt(usage.reasoningTokens),
        estimated_cost_usd: estimateAiCostUsd({
          provider: input.provider,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          cacheHitTokens: usage.cacheHitTokens,
          cacheMissTokens: usage.cacheMissTokens,
        }),
        error_code: truncate(input.errorCode, 100),
        error_message: truncate(input.errorMessage, 1000),
        practice_attempt_id: input.practiceAttemptId ?? null,
        analysis_job_id: input.analysisJobId ?? null,
        debate_session_id: input.debateSessionId ?? null,
        ai_quality_run_id: input.aiQualityRunId ?? null,
        metadata: input.metadata ?? {},
      })
      .select("id")
      .single();

    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("AI provider request insert failed:", error.message);
      }
      return null;
    }
    return (data as { id: string }).id;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "AI provider request skipped:",
        error instanceof Error ? error.message : error
      );
    }
    return null;
  }
}

export async function linkAiProviderRequestsToQualityRun(
  providerRequestIds: Array<string | null | undefined>,
  aiQualityRunId: string | null | undefined,
  supabase?: SupabaseClient | null
) {
  const client =
    supabase === undefined ? await safelyGetDefaultProviderRequestClient() : supabase;
  const ids = Array.from(
    new Set(providerRequestIds.filter((id): id is string => Boolean(id)))
  );
  if (!client || !aiQualityRunId || ids.length === 0) return;

  try {
    const { error } = await client
      .from("ai_provider_requests")
      .update({ ai_quality_run_id: aiQualityRunId })
      .in("id", ids);
    if (error && process.env.NODE_ENV === "development") {
      console.warn("AI provider request link failed:", error.message);
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "AI provider request link skipped:",
        error instanceof Error ? error.message : error
      );
    }
  }
}

async function getDefaultProviderRequestClient() {
  const { tryCreateAdminClient } = await import("@/lib/supabase/admin");
  return tryCreateAdminClient();
}

async function safelyGetDefaultProviderRequestClient() {
  try {
    return await getDefaultProviderRequestClient();
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "AI provider request admin client unavailable:",
        error instanceof Error ? error.message : error
      );
    }
    return null;
  }
}
