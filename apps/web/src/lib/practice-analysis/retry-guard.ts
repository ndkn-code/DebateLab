import type { AnalysisJobStatus } from "./types";

export type PracticeAnalysisRetryDecision =
  | {
      action: "process";
      deliveryCount: number;
      allowedStatuses: AnalysisJobStatus[];
      reason: "queued" | "reclaim_stale_processing";
    }
  | {
      action: "fail";
      reason: "db_retry_limit_exceeded" | "queue_retry_limit_exceeded";
    }
  | {
      action: "skip";
      reason: "processing_not_stale";
    };

export function getPracticeAnalysisRetryDecision(params: {
  jobStatus: AnalysisJobStatus;
  dbDeliveryCount: number | null | undefined;
  maxAttempts: number | null | undefined;
  queueDeliveryCount: number | null | undefined;
  /** Delivery leases can expire without a provider attempt; keep this wider. */
  maxQueueDeliveries?: number;
  startedAt: string | null | undefined;
  nowMs?: number;
  staleProcessingMs?: number;
}): PracticeAnalysisRetryDecision {
  const maxAttempts = Math.max(1, params.maxAttempts || 3);
  const dbDeliveryCount = Math.max(0, params.dbDeliveryCount || 0);
  const queueDeliveryCount = Math.max(1, params.queueDeliveryCount || 1);

  if (dbDeliveryCount >= maxAttempts) {
    return { action: "fail", reason: "db_retry_limit_exceeded" };
  }

  const maxQueueDeliveries = Math.max(
    maxAttempts,
    params.maxQueueDeliveries ?? 10
  );
  if (queueDeliveryCount > maxQueueDeliveries) {
    return { action: "fail", reason: "queue_retry_limit_exceeded" };
  }

  const staleProcessingMs = params.staleProcessingMs ?? 3 * 60 * 1000;
  const nowMs = params.nowMs ?? Date.now();
  const startedAtMs = params.startedAt ? Date.parse(params.startedAt) : 0;
  const processingAgeMs =
    startedAtMs > 0 && Number.isFinite(startedAtMs) ? nowMs - startedAtMs : 0;

  if (params.jobStatus === "processing" && processingAgeMs < staleProcessingMs) {
    return { action: "skip", reason: "processing_not_stale" };
  }

  // A queue delivery is not necessarily an AI-provider attempt. In particular,
  // a duplicate received while another worker holds the lease must not consume
  // the learner's three scoring attempts.
  const deliveryCount = dbDeliveryCount + 1;

  if (params.jobStatus === "processing") {
    return {
      action: "process",
      deliveryCount,
      allowedStatuses: ["processing"],
      reason: "reclaim_stale_processing",
    };
  }

  return {
    action: "process",
    deliveryCount,
    allowedStatuses: ["queued"],
    reason: "queued",
  };
}
