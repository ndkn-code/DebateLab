import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AiGradingDelivery,
  AiGradingJob,
} from "@/lib/ai/grading/contracts";

export type ClaimResult = {
  outcome: "claimed" | "completed" | "lease_active" | "exhausted" | "fatal";
  claimToken: string | null;
  attemptCount: number;
  manualRetryCount: number;
  preparedPayload: unknown | null;
  outputPayload: unknown | null;
  outputHash: string | null;
  providerStartedAt: string | null;
};

export type ProviderReservation =
  | "reserved"
  | "output_ready"
  | "outcome_unknown";

export interface AiGradingRepository {
  claim(delivery: AiGradingDelivery): Promise<ClaimResult>;
  checkpointPrepared(
    runId: string,
    claimToken: string,
    payload: unknown,
    hash: string,
  ): Promise<void>;
  reserveProvider(
    runId: string,
    claimToken: string,
  ): Promise<ProviderReservation>;
  checkpointProviderFailure(
    runId: string,
    claimToken: string,
    failureKind: string,
  ): Promise<void>;
  checkpointOutput(
    runId: string,
    claimToken: string,
    payload: unknown,
    hash: string,
  ): Promise<void>;
  complete(runId: string, claimToken: string, phase: string): Promise<boolean>;
  fail(
    runId: string,
    claimToken: string,
    params: { code: string; message: string; retryable: boolean },
  ): Promise<"retryable" | "fatal" | "claim_lost">;
}
function firstRow(value: unknown): Record<string, unknown> | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const row = value[0];
  return row && typeof row === "object"
    ? (row as Record<string, unknown>)
    : null;
}

function parseClaim(value: unknown): ClaimResult {
  const row = firstRow(value);
  if (!row) throw new Error("AI_GRADING_CLAIM_EMPTY");
  const outcome = row.outcome;
  if (
    outcome !== "claimed" &&
    outcome !== "completed" &&
    outcome !== "lease_active" &&
    outcome !== "exhausted" &&
    outcome !== "fatal"
  ) {
    throw new Error("AI_GRADING_CLAIM_OUTCOME_INVALID");
  }
  return {
    outcome,
    claimToken: typeof row.claim_token === "string" ? row.claim_token : null,
    attemptCount: Number(row.attempt_count ?? 0),
    manualRetryCount: Number(row.manual_retry_count ?? 0),
    preparedPayload: row.prepared_payload ?? null,
    outputPayload: row.output_payload ?? null,
    outputHash: typeof row.output_hash === "string" ? row.output_hash : null,
    providerStartedAt:
      typeof row.provider_started_at === "string"
        ? row.provider_started_at
        : null,
  };
}

function assertRpc(error: { message: string } | null, label: string): void {
  if (error) throw new Error(`${label}: ${error.message}`);
}

export function createProductionRepository(): AiGradingRepository {
  const supabase = createAdminClient();
  return {
    async claim(delivery) {
      const { data, error } = await supabase.rpc("claim_ai_grading_delivery", {
        p_run_id: delivery.job.workflowRunId,
        p_kind: delivery.job.kind,
        p_source_id: delivery.job.sourceId,
        p_delivery_id: delivery.messageId,
        p_delivery_attempt: delivery.deliveryAttempt,
        p_lease_seconds: 20 * 60,
      });
      assertRpc(error, "claim AI grading delivery");
      return parseClaim(data);
    },
    async checkpointPrepared(runId, claimToken, payload, hash) {
      const { error } = await supabase.rpc("checkpoint_ai_grading_prepared", {
        p_run_id: runId,
        p_claim_token: claimToken,
        p_payload: payload,
        p_hash: hash,
      });
      assertRpc(error, "checkpoint AI grading preparation");
    },
    async reserveProvider(runId, claimToken) {
      const { data, error } = await supabase.rpc(
        "reserve_ai_grading_provider_call",
        { p_run_id: runId, p_claim_token: claimToken },
      );
      assertRpc(error, "reserve AI grading provider call");
      if (
        data !== "reserved" &&
        data !== "output_ready" &&
        data !== "outcome_unknown"
      ) {
        throw new Error("AI_GRADING_PROVIDER_RESERVATION_INVALID");
      }
      return data;
    },
    async checkpointProviderFailure(runId, claimToken, failureKind) {
      const { error } = await supabase.rpc(
        "checkpoint_ai_grading_provider_failure",
        {
          p_run_id: runId,
          p_claim_token: claimToken,
          p_failure_kind: failureKind,
        },
      );
      assertRpc(error, "checkpoint AI grading provider failure");
    },
    async checkpointOutput(runId, claimToken, payload, hash) {
      const { error } = await supabase.rpc("checkpoint_ai_grading_output", {
        p_run_id: runId,
        p_claim_token: claimToken,
        p_payload: payload,
        p_hash: hash,
        p_version: 1,
      });
      assertRpc(error, "checkpoint AI grading output");
    },
    async complete(runId, claimToken, phase) {
      const { data, error } = await supabase.rpc(
        "complete_ai_grading_delivery",
        { p_run_id: runId, p_claim_token: claimToken, p_phase: phase },
      );
      assertRpc(error, "complete AI grading delivery");
      return data === true;
    },
    async fail(runId, claimToken, params) {
      const { data, error } = await supabase.rpc("fail_ai_grading_delivery", {
        p_run_id: runId,
        p_claim_token: claimToken,
        p_error_code: params.code,
        p_error_message: params.message,
        p_retryable: params.retryable,
      });
      assertRpc(error, "fail AI grading delivery");
      if (data !== "retryable" && data !== "fatal" && data !== "claim_lost")
        throw new Error("AI_GRADING_FAILURE_OUTCOME_INVALID");
      return data;
    },
  };
}

export type ReconciliationCandidate = AiGradingJob;

export async function listReconciliationCandidates(
  limit = 50,
): Promise<ReconciliationCandidate[]> {
  const { data, error } = await createAdminClient().rpc(
    "list_ai_grading_reconciliation_candidates",
    { p_limit: limit },
  );
  assertRpc(error, "list AI grading reconciliation candidates");
  if (!Array.isArray(data)) return [];
  return data.map((row) => {
    const item = row as Record<string, unknown>;
    return {
      schemaVersion: 1,
      kind: item.workflow_kind as AiGradingJob["kind"],
      sourceId: String(item.source_id),
      workflowRunId: String(item.workflow_run_id),
    };
  });
}
