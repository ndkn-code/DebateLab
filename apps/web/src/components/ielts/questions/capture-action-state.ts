export type CaptureActionState = "draft" | "pending" | "retryable" | "complete";

/**
 * A Writing/Speaking response id represents one durable paid scoring run.
 * Completed runs are terminal until the backend introduces explicit revisions.
 */
export function getCaptureActionState(params: {
  responseId: string | null;
  scored: boolean;
  failed: boolean;
  submitting: boolean;
}): CaptureActionState {
  if (params.scored) return "complete";
  if (params.submitting) return "pending";
  if (params.responseId && params.failed) return "retryable";
  if (params.responseId) return "pending";
  return "draft";
}

export function canStartPaidScoring(state: CaptureActionState): boolean {
  return state === "draft" || state === "retryable";
}
