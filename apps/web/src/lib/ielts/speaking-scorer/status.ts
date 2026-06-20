/**
 * Map the typed `speaking_responses.status` lifecycle onto the generic
 * practice-analysis job state machine so the IELTS Speaking scorer reuses the
 * already-tested {@link getPracticeAnalysisRetryDecision} (stale-reclaim +
 * delivery cap) without a debate-coupled `analysis_jobs` row. Pure + unit
 * tested. Mirrors the Writing scorer status module (same `ielts_response_status`
 * enum).
 */
import {
  getPracticeAnalysisRetryDecision,
  type PracticeAnalysisRetryDecision,
} from "@/lib/practice-analysis/retry-guard";
import type { AnalysisJobStatus } from "@/lib/practice-analysis/types";
import type { Database } from "@/types/supabase";
import {
  IELTS_SPEAKING_MAX_ATTEMPTS,
  IELTS_SPEAKING_STALE_SCORING_MS,
} from "./constants";

export type SpeakingResponseStatus =
  Database["public"]["Enums"]["ielts_response_status"];

/** Statuses a Speaking response cannot be re-scored from (already final). */
export const TERMINAL_SPEAKING_STATUSES: readonly SpeakingResponseStatus[] = [
  "scored",
  "overridden",
];

export function isTerminalSpeakingStatus(
  status: SpeakingResponseStatus,
): boolean {
  return TERMINAL_SPEAKING_STATUSES.includes(status);
}

export function mapSpeakingStatusToJobStatus(
  status: SpeakingResponseStatus,
): AnalysisJobStatus {
  switch (status) {
    case "scoring":
      return "processing";
    case "scored":
    case "overridden":
      return "completed";
    case "failed":
    case "pending":
      return "queued";
  }
}

/**
 * Translate the guard's allowed job statuses into the `speaking_responses`
 * statuses a claim UPDATE may transition from. `queued` → a not-yet/again-
 * scorable row (`pending`/`failed`); `processing` → reclaiming a stale
 * `scoring` row.
 */
export function claimableSpeakingStatuses(
  allowed: readonly AnalysisJobStatus[],
): SpeakingResponseStatus[] {
  const statuses: SpeakingResponseStatus[] = [];
  if (allowed.includes("queued")) {
    statuses.push("pending", "failed");
  }
  if (allowed.includes("processing")) {
    statuses.push("scoring");
  }
  return statuses;
}

export function decideSpeakingScoringAction(params: {
  status: SpeakingResponseStatus;
  updatedAt: string | null;
  queueDeliveryCount: number;
  nowMs?: number;
}): PracticeAnalysisRetryDecision {
  return getPracticeAnalysisRetryDecision({
    jobStatus: mapSpeakingStatusToJobStatus(params.status),
    dbDeliveryCount: 0,
    maxAttempts: IELTS_SPEAKING_MAX_ATTEMPTS,
    queueDeliveryCount: params.queueDeliveryCount,
    startedAt: params.updatedAt,
    nowMs: params.nowMs,
    staleProcessingMs: IELTS_SPEAKING_STALE_SCORING_MS,
  });
}
