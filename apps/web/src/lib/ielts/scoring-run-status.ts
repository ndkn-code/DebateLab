import type { AiWorkflowStatus } from "@/lib/ai/workflow-runs";

export const IELTS_SCORING_MAX_AUTOMATIC_ATTEMPTS = 3;

export type IeltsScoringPublicState =
  | "not_scheduled"
  | "queued"
  | "processing"
  | "finalizing"
  | "provisional_ready"
  | "retry_scheduled"
  | "failed_terminal"
  | "cancelled";

export type IeltsScoringRecommendedAction =
  | "wait"
  | "request_manual_retry"
  | "manual_review"
  | "none";

/**
 * Minimum workflow shape needed by learner/teacher status projections. Keeping
 * this structural avoids importing the server-only workflow repository into
 * API contracts and fixtures.
 */
export interface IeltsScoringRunLike {
  id: string;
  workflow_run_id: string | null;
  status: AiWorkflowStatus;
  phase: string;
  progress: Record<string, unknown> | null;
  workflow_attempt_count: number;
  provider_attempt_count: number;
  last_error_code: string | null;
  updated_at: string;
  completed_at: string | null;
}

export interface IeltsScoringRunStatus {
  runId: string | null;
  providerRunId: string | null;
  state: IeltsScoringPublicState;
  phase: string | null;
  progress: number | null;
  automaticAttemptsUsed: number;
  automaticAttemptsRemaining: number;
  providerAttemptsUsed: number;
  retryable: boolean;
  manualRetryAvailable: boolean;
  recommendedAction: IeltsScoringRecommendedAction;
  failureCode: "retry_exhausted" | "unavailable" | null;
  updatedAt: string | null;
  completedAt: string | null;
}

function progressPercent(progress: Record<string, unknown> | null): number | null {
  if (!progress) return null;
  const candidate = progress.percent ?? progress.progress;
  if (typeof candidate !== "number" || !Number.isFinite(candidate)) return null;
  return Math.max(0, Math.min(100, Math.round(candidate)));
}

function attemptsRemaining(run: IeltsScoringRunLike): number {
  return Math.max(
    0,
    IELTS_SCORING_MAX_AUTOMATIC_ATTEMPTS - run.workflow_attempt_count,
  );
}

function isRetryableFailure(run: IeltsScoringRunLike): boolean {
  return (
    run.status === "failed" &&
    run.last_error_code === "RETRYABLE_WORKFLOW_FAILED" &&
    attemptsRemaining(run) > 0
  );
}

function isExhaustedFailure(run: IeltsScoringRunLike): boolean {
  return (
    run.status === "failed" &&
    (run.last_error_code === "WORKFLOW_RETRY_EXHAUSTED" ||
      run.workflow_attempt_count >= IELTS_SCORING_MAX_AUTOMATIC_ATTEMPTS)
  );
}

function publicState(run: IeltsScoringRunLike): IeltsScoringPublicState {
  if (run.status === "completed") return "provisional_ready";
  if (run.status === "core_completed") return "finalizing";
  if (run.status === "cancelled") return "cancelled";
  if (run.status === "failed") {
    return isRetryableFailure(run) ? "retry_scheduled" : "failed_terminal";
  }
  if (run.status === "queued" || run.status === "starting") return "queued";
  return "processing";
}

/**
 * Public-safe workflow projection. Internal error messages and provider
 * payloads are intentionally excluded; callers get only bounded retry state
 * and an actionable terminal outcome.
 */
export function toIeltsScoringRunStatus(
  run: IeltsScoringRunLike | null,
): IeltsScoringRunStatus {
  if (!run) {
    return {
      runId: null,
      providerRunId: null,
      state: "not_scheduled",
      phase: null,
      progress: null,
      automaticAttemptsUsed: 0,
      automaticAttemptsRemaining: IELTS_SCORING_MAX_AUTOMATIC_ATTEMPTS,
      providerAttemptsUsed: 0,
      retryable: false,
      manualRetryAvailable: false,
      recommendedAction: "none",
      failureCode: null,
      updatedAt: null,
      completedAt: null,
    };
  }

  const retryable = isRetryableFailure(run);
  const exhausted = isExhaustedFailure(run);
  const state = publicState(run);
  const terminalFailure = state === "failed_terminal";
  return {
    runId: run.id,
    providerRunId: run.workflow_run_id,
    state,
    phase: run.phase,
    progress: progressPercent(run.progress),
    automaticAttemptsUsed: Math.max(0, run.workflow_attempt_count),
    automaticAttemptsRemaining: attemptsRemaining(run),
    providerAttemptsUsed: Math.max(0, run.provider_attempt_count),
    retryable,
    // This is visibility only. A future authorized LMS action may consume it;
    // no learner-facing mutation is introduced by this backend contract.
    manualRetryAvailable: exhausted,
    recommendedAction: retryable
      ? "wait"
      : exhausted
        ? "request_manual_retry"
        : terminalFailure
          ? "manual_review"
          : state === "provisional_ready" || state === "cancelled"
            ? "none"
            : "wait",
    failureCode: terminalFailure
      ? exhausted
        ? "retry_exhausted"
        : "unavailable"
      : null,
    updatedAt: run.updated_at,
    completedAt: run.completed_at,
  };
}
