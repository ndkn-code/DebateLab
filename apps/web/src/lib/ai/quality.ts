import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createAiQualityPreview,
  estimateAiCostUsd,
  isNegativeAiQualityRating,
  type AiQualityRatingInput,
  type AiQualityRunInput,
  type AiQualityReviewStatus,
} from "@/lib/ai/quality-model";
import { linkAiProviderRequestsToQualityRun } from "@/lib/ai/provider-requests";

function clampInt(value: number | null | undefined, min: number, max?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return Math.max(min, max == null ? rounded : Math.min(max, rounded));
}

function clampConfidence(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.max(0, Math.min(1, value));
}

function truncate(value: string | null | undefined, max: number) {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max) : trimmed;
}

export async function recordAiQualityRun(
  supabase: SupabaseClient,
  input: AiQualityRunInput
) {
  const usage = input.usage ?? {};
  const estimatedCost =
    input.estimatedCostUsd ??
    estimateAiCostUsd({
      provider: input.provider,
      inputTokens: usage.inputTokens,
      outputTokens: usage.outputTokens,
      cacheHitTokens: usage.cacheHitTokens,
      cacheMissTokens: usage.cacheMissTokens,
    });

  try {
    const { data, error } = await supabase
      .from("ai_quality_runs")
      .insert({
        user_id: input.userId,
        output_type: input.outputType,
        status: input.status ?? "success",
        source_route: input.sourceRoute ?? null,
        provider: input.provider,
        requested_provider: input.requestedProvider ?? null,
        model: input.model,
        prompt_bundle_key: input.promptBundleKey ?? null,
        prompt_bundle_version: input.promptBundleVersion ?? null,
        prompt_hash: input.promptHash ?? null,
        rubric_key: input.rubricKey ?? null,
        rubric_version: input.rubricVersion ?? null,
        practice_track: input.practiceTrack ?? null,
        practice_language: input.practiceLanguage ?? null,
        difficulty: input.difficulty ?? null,
        debate_format: input.debateFormat ?? null,
        side: input.side ?? null,
        ai_side: input.aiSide ?? null,
        topic_title: input.topicTitle ?? null,
        latency_ms: clampInt(input.latencyMs, 0),
        input_tokens: clampInt(usage.inputTokens, 0),
        output_tokens: clampInt(usage.outputTokens, 0),
        total_tokens: clampInt(usage.totalTokens, 0),
        cache_hit_tokens: clampInt(usage.cacheHitTokens, 0),
        cache_miss_tokens: clampInt(usage.cacheMissTokens, 0),
        reasoning_tokens: clampInt(usage.reasoningTokens, 0),
        estimated_cost_usd: estimatedCost,
        fallback_used: Boolean(input.fallbackUsed),
        error_code: input.errorCode ?? null,
        error_message: truncate(input.errorMessage, 1000),
        winner: input.winner ?? null,
        score: clampInt(input.score, 0, 100),
        confidence: clampConfidence(input.confidence),
        output_preview: createAiQualityPreview(input.outputText),
        output_text: truncate(input.outputText, 60000),
        input_preview: createAiQualityPreview(input.inputPreview, 1000),
        practice_attempt_id: input.practiceAttemptId ?? null,
        analysis_job_id: input.analysisJobId ?? null,
        debate_session_id: input.debateSessionId ?? null,
        debate_duel_id: input.debateDuelId ?? null,
        debate_duel_judgment_id: input.debateDuelJudgmentId ?? null,
        metadata: input.metadata ?? {},
      })
      .select("id")
      .single();

    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("AI quality run insert failed:", error.message);
      }
      return null;
    }

    const runId = (data as { id: string }).id;
    await linkAiProviderRequestsToQualityRun(input.providerRequestIds ?? [], runId, supabase);
    return runId;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "AI quality run skipped:",
        error instanceof Error ? error.message : error
      );
    }
    return null;
  }
}

export async function recordAiQualityRating(
  supabase: SupabaseClient,
  input: AiQualityRatingInput
) {
  const { data, error } = await supabase
    .from("ai_quality_ratings")
    .upsert(
      {
        run_id: input.runId,
        user_id: input.userId,
        usefulness: input.usefulness ?? null,
        fairness: input.fairness ?? null,
        reason_tags: input.reasonTags ?? [],
        comment: truncate(input.comment, 1200),
        locale: input.locale ?? null,
        route: truncate(input.route, 500),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "run_id,user_id" }
    )
    .select("id, usefulness, fairness, reason_tags")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return data as {
    id: string;
    usefulness: AiQualityRatingInput["usefulness"];
    fairness: AiQualityRatingInput["fairness"];
    reason_tags: string[];
  };
}

export function deriveReviewStatusFromRating(input: AiQualityRatingInput): AiQualityReviewStatus {
  return isNegativeAiQualityRating(input) ? "flagged" : "reviewed";
}
