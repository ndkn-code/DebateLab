import { NextRequest, NextResponse } from "next/server";
import { isAdminUser } from "@/lib/auth/admin";
import { requireRequestAuth } from "@/lib/api/request-auth";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import {
  type AiQualityFairness,
  type AiQualityOutputType,
  type AiQualityReasonTag,
  type AiQualityUsefulness,
} from "@/lib/ai/quality-model";
import {
  computeAiQualityKpis,
  computeProviderRequestKpis,
  groupProviderRequests,
  isFlaggedAiQualityRow,
} from "@/lib/ai/quality-dashboard";
import type { AiQualityRating, AiQualityRun, Profile } from "@/types";

export const dynamic = "force-dynamic";

type AiQualityRunWithRating = AiQualityRun & {
  rating: AiQualityRating | null;
  user: Pick<Profile, "id" | "email" | "display_name"> | null;
  contextText: string | null;
};

type ProviderRequestRow = {
  id: string;
  user_id: string | null;
  provider: string;
  model: string;
  status: "success" | "error";
  source_route: string | null;
  output_type: string | null;
  request_id: string | null;
  response_status: number | null;
  finish_reason: string | null;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  total_tokens: number | null;
  cache_hit_tokens: number | null;
  cache_miss_tokens: number | null;
  reasoning_tokens: number | null;
  estimated_cost_usd: number | string | null;
  error_code: string | null;
  error_message: string | null;
  practice_attempt_id: string | null;
  analysis_job_id: string | null;
  debate_session_id: string | null;
  ai_quality_run_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

function isProviderRequestNearRun(
  request: Pick<ProviderRequestRow, "created_at">,
  row: Pick<AiQualityRunWithRating, "created_at">
) {
  const requestTime = new Date(request.created_at).getTime();
  const runTime = new Date(row.created_at).getTime();
  if (!Number.isFinite(requestTime) || !Number.isFinite(runTime)) return false;

  // Fallback matching is only for legacy rows that predate direct ai_quality_run_id
  // links. Keep it close to the run save time so QA replays or later retries on the
  // same practice attempt do not appear as calls used by an older run.
  return Math.abs(runTime - requestTime) <= 20 * 60 * 1000;
}

function getNumberParam(value: string | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, Math.round(parsed)));
}

export async function GET(req: NextRequest) {
  const auth = await requireRequestAuth(req);
  if (!auth.ok) return auth.errorResponse;

  const { supabase, user } = auth;
  if (!(await isAdminUser(supabase, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = tryCreateAdminClient() ?? supabase;
  const params = new URL(req.url).searchParams;
  const days = getNumberParam(params.get("rangeDays"), 7, 1, 90);
  const limit = getNumberParam(params.get("limit"), 120, 20, 300);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  const outputType = params.get("outputType") as AiQualityOutputType | null;
  const language = params.get("language");
  const provider = params.get("provider");
  const status = params.get("status");
  const usefulness = params.get("usefulness") as AiQualityUsefulness | null;
  const fairness = params.get("fairness") as AiQualityFairness | null;
  const reasonTag = params.get("reasonTag") as AiQualityReasonTag | null;
  const tab = params.get("tab");

  let query = admin
    .from("ai_quality_runs")
    .select("*")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (outputType) query = query.eq("output_type", outputType);
  if (language === "en" || language === "vi") query = query.eq("practice_language", language);
  if (provider) query = query.ilike("provider", `%${provider}%`);
  if (status === "success" || status === "error") query = query.eq("status", status);
  if (tab === "flagged") query = query.in("review_status", ["flagged", "unreviewed", "reviewed"]);

  const { data: runData, error: runError } = await query;
  if (runError) {
    return NextResponse.json({ error: "Unable to load AI quality runs" }, { status: 500 });
  }

  const runs = (runData ?? []) as AiQualityRun[];
  const runIds = runs.map((run) => run.id);
  const userIds = Array.from(new Set(runs.map((run) => run.user_id)));
  const attemptIds = Array.from(
    new Set(
      runs
        .map((run) => run.practice_attempt_id)
        .filter((id): id is string => Boolean(id))
    )
  );
  const duelIds = Array.from(
    new Set(
      runs
        .map((run) => run.debate_duel_id)
        .filter((id): id is string => Boolean(id))
    )
  );

  let providerRequestQuery = admin
    .from("ai_provider_requests")
    .select("*")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (provider) providerRequestQuery = providerRequestQuery.ilike("provider", `%${provider}%`);
  if (outputType) providerRequestQuery = providerRequestQuery.eq("output_type", outputType);
  if (status === "success" || status === "error") {
    providerRequestQuery = providerRequestQuery.eq("status", status);
  }

  const [
    ratingsResult,
    profilesResult,
    attemptsResult,
    speechesResult,
    providerRequestsResult,
  ] = await Promise.all([
    runIds.length
      ? admin.from("ai_quality_ratings").select("*").in("run_id", runIds)
      : Promise.resolve({ data: [], error: null }),
    userIds.length
      ? admin.from("profiles").select("id,email,display_name").in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
    attemptIds.length
      ? admin.from("practice_attempts").select("id,topic_title,side,transcript,rounds").in("id", attemptIds)
      : Promise.resolve({ data: [], error: null }),
    duelIds.length
      ? admin
          .from("debate_duel_speeches")
          .select("duel_id,round_number,side,speech_type,transcript")
          .in("duel_id", duelIds)
          .order("round_number", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    providerRequestQuery,
  ]);

  if (
    ratingsResult.error ||
    profilesResult.error ||
    attemptsResult.error ||
    speechesResult.error ||
    providerRequestsResult.error
  ) {
    return NextResponse.json({ error: "Unable to load AI quality details" }, { status: 500 });
  }

  const ratingByRun = new Map(
    ((ratingsResult.data ?? []) as AiQualityRating[]).map((rating) => [
      rating.run_id,
      rating,
    ])
  );
  const profileById = new Map(
    ((profilesResult.data ?? []) as Pick<Profile, "id" | "email" | "display_name">[]).map(
      (profile) => [profile.id, profile]
    )
  );
  const attemptById = new Map(
    ((attemptsResult.data ?? []) as Array<{
      id: string;
      topic_title: string;
      side: string;
      transcript: string;
      rounds: unknown;
    }>).map((attempt) => [
      attempt.id,
      [
        `Topic: ${attempt.topic_title}`,
        `Side: ${attempt.side}`,
        "",
        attempt.transcript,
        attempt.rounds ? `\nRounds:\n${JSON.stringify(attempt.rounds, null, 2)}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    ])
  );
  const speechesByDuelId = new Map<string, string[]>();
  ((speechesResult.data ?? []) as Array<{
    duel_id: string;
    round_number: number;
    side: string;
    speech_type: string;
    transcript: string;
  }>).forEach((speech) => {
    const list = speechesByDuelId.get(speech.duel_id) ?? [];
    list.push(
      `Round ${speech.round_number} ${speech.side} ${speech.speech_type}:\n${speech.transcript}`
    );
    speechesByDuelId.set(speech.duel_id, list);
  });

  let rows: AiQualityRunWithRating[] = runs.map((run) => ({
    ...run,
    rating: ratingByRun.get(run.id) ?? null,
    user: profileById.get(run.user_id) ?? null,
    contextText:
      (run.practice_attempt_id ? attemptById.get(run.practice_attempt_id) : null) ??
      (run.debate_duel_id ? speechesByDuelId.get(run.debate_duel_id)?.join("\n\n") : null) ??
      null,
  }));

  if (usefulness) {
    rows = rows.filter((row) => row.rating?.usefulness === usefulness);
  }
  if (fairness) {
    rows = rows.filter((row) => row.rating?.fairness === fairness);
  }
  if (reasonTag) {
    rows = rows.filter((row) => row.rating?.reason_tags.includes(reasonTag));
  }
  if (tab === "flagged") {
    rows = rows.filter(isFlaggedAiQualityRow);
  }

  const visibleRunIds = new Set(rows.map((row) => row.id));
  const visibleAttemptIds = new Set(
    rows
      .map((row) => row.practice_attempt_id)
      .filter((id): id is string => Boolean(id))
  );
  const visibleJobIds = new Set(
    rows
      .map((row) => row.analysis_job_id)
      .filter((id): id is string => Boolean(id))
  );
  const visibleSessionIds = new Set(
    rows
      .map((row) => row.debate_session_id)
      .filter((id): id is string => Boolean(id))
  );
  const providerRequests = (providerRequestsResult.data ?? []) as ProviderRequestRow[];
  const providerRequestsByRunId = rows.reduce<Record<string, ProviderRequestRow[]>>(
    (acc, row) => {
      acc[row.id] = [];
      return acc;
    },
    {}
  );

  providerRequests.forEach((request) => {
    const directRunId =
      request.ai_quality_run_id && visibleRunIds.has(request.ai_quality_run_id)
        ? request.ai_quality_run_id
        : null;
    const fallbackRun = directRunId
      ? null
      : rows.find(
          (row) =>
            isProviderRequestNearRun(request, row) &&
            ((request.practice_attempt_id &&
              row.practice_attempt_id === request.practice_attempt_id &&
              visibleAttemptIds.has(request.practice_attempt_id)) ||
            (request.analysis_job_id &&
              row.analysis_job_id === request.analysis_job_id &&
              visibleJobIds.has(request.analysis_job_id)) ||
            (request.debate_session_id &&
              row.debate_session_id === request.debate_session_id &&
              visibleSessionIds.has(request.debate_session_id)))
        );
    const runId = directRunId ?? fallbackRun?.id;
    if (runId && providerRequestsByRunId[runId]) {
      providerRequestsByRunId[runId].push(request);
    }
  });

  return NextResponse.json({
    kpis: computeAiQualityKpis(rows),
    providerRequestKpis: computeProviderRequestKpis(providerRequests),
    providerRequestGroups: groupProviderRequests(providerRequests),
    providerRequestsByRunId,
    rows,
    filters: {
      rangeDays: days,
      outputType,
      language,
      provider,
      status,
      usefulness,
      fairness,
      reasonTag,
      tab,
    },
  });
}
