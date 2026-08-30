import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

export type IeltsScoringKind = "writing" | "speaking";
export const IELTS_MANUAL_RETRY_LIMIT = 1;

export interface ManualRetryResult {
  responseId: string;
  responseKind: IeltsScoringKind;
  responseRevision: number;
  workflowRunId: string | null;
  status: string;
  manualRetryCount: number;
  idempotentReplay: boolean;
}

type RetryRpcRow = {
  response_id: string;
  response_kind: IeltsScoringKind;
  response_revision: number;
  workflow_run_id: string | null;
  status: string;
  manual_retry_count: number;
  idempotent_replay?: boolean;
};

/**
 * Atomically authorizes and reserves the one teacher retry. The database
 * function is intentionally the boundary for the compare-and-swap: it must
 * lock the response and workflow row, verify the current revision and an
 * exhausted terminal run, consume the retry quota, and append the audit event
 * before returning. No provider or metering call belongs in this function.
 */
export async function reserveIeltsManualRetry(
  client: unknown,
  params: {
    clubId: string;
    classId: string;
    attemptId: string;
    responseId: string;
    responseKind: IeltsScoringKind;
    expectedRevision: number;
    idempotencyKey: string;
    actorId: string;
  },
): Promise<ManualRetryResult> {
  const db = client as SupabaseClient;
  const result = await db.rpc("retry_ielts_scoring_workflow", {
    p_club_id: params.clubId,
    p_class_id: params.classId,
    p_attempt_id: params.attemptId,
    p_response_id: params.responseId,
    p_response_kind: params.responseKind,
    p_expected_revision: params.expectedRevision,
    p_idempotency_key: params.idempotencyKey,
    p_actor_id: params.actorId,
  } as never);
  if (result.error || !result.data) {
    throw new Error(`reserveIeltsManualRetry: ${result.error?.message ?? "retry was not reserved"}`);
  }
  const row = (Array.isArray(result.data) ? result.data[0] : result.data) as RetryRpcRow | undefined;
  if (!row) throw new Error("reserveIeltsManualRetry: no retry returned");
  if (row.response_id !== params.responseId || row.response_kind !== params.responseKind) {
    throw new Error("reserveIeltsManualRetry: response identity mismatch");
  }
  if (row.response_revision !== params.expectedRevision) {
    throw new Error("reserveIeltsManualRetry: response revision changed concurrently");
  }
  if (!Number.isInteger(row.manual_retry_count) || row.manual_retry_count < 1 || row.manual_retry_count > IELTS_MANUAL_RETRY_LIMIT) {
    throw new Error("reserveIeltsManualRetry: manual retry quota exceeded");
  }
  return {
    responseId: row.response_id,
    responseKind: row.response_kind,
    responseRevision: row.response_revision,
    workflowRunId: row.workflow_run_id ?? null,
    status: row.status,
    manualRetryCount: row.manual_retry_count,
    idempotentReplay: row.idempotent_replay === true,
  };
}
