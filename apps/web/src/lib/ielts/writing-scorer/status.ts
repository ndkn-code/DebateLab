/**
 * Map the typed `writing_responses.status` lifecycle onto the generic
 * practice-analysis job state machine so the IELTS Writing scorer reuses the
 * already-tested {@link getPracticeAnalysisRetryDecision} (stale-reclaim +
 * delivery cap) without a debate-coupled `analysis_jobs` row. Pure + unit
 * tested.
 */
import {
  getPracticeAnalysisRetryDecision,
  type PracticeAnalysisRetryDecision,
} from "@/lib/practice-analysis/retry-guard";
import type { AnalysisJobStatus } from "@/lib/practice-analysis/types";
import type { Database } from "@/types/supabase";
import {
  IELTS_WRITING_MAX_ATTEMPTS,
  IELTS_WRITING_STALE_SCORING_MS,
} from "./constants";

export type WritingResponseStatus =
  Database["public"]["Enums"]["ielts_response_status"];

/** Statuses a Writing response cannot be re-scored from (already final). */
export const TERMINAL_WRITING_STATUSES: readonly WritingResponseStatus[] = [
  "scored",
  "overridden",
];

export function isTerminalWritingStatus(
  status: WritingResponseStatus,
): boolean {
  return TERMINAL_WRITING_STATUSES.includes(status);
}

export function mapWritingStatusToJobStatus(
  status: WritingResponseStatus,
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
 * Translate the guard's allowed job statuses into the `writing_responses`
 * statuses a claim UPDATE may transition from. `queued` → a not-yet/again-
 * scorable row (`pending`/`failed`); `processing` → reclaiming a stale
 * `scoring` row.
 */
export function claimableWritingStatuses(
  allowed: readonly AnalysisJobStatus[],
): WritingResponseStatus[] {
  const statuses: WritingResponseStatus[] = [];
  if (allowed.includes("queued")) {
    statuses.push("pending", "failed");
  }
  if (allowed.includes("processing")) {
    statuses.push("scoring");
  }
  return statuses;
}

export function decideWritingScoringAction(params: {
  status: WritingResponseStatus;
  updatedAt: string | null;
  queueDeliveryCount: number;
  nowMs?: number;
}): PracticeAnalysisRetryDecision {
  return getPracticeAnalysisRetryDecision({
    jobStatus: mapWritingStatusToJobStatus(params.status),
    dbDeliveryCount: 0,
    maxAttempts: IELTS_WRITING_MAX_ATTEMPTS,
    queueDeliveryCount: params.queueDeliveryCount,
    startedAt: params.updatedAt,
    nowMs: params.nowMs,
    staleProcessingMs: IELTS_WRITING_STALE_SCORING_MS,
  });
}
