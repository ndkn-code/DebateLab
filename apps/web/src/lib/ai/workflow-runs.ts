import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export const AI_WORKFLOW_KINDS = [
  "practice_analysis",
  "ielts_speaking_score",
  "ielts_writing_score",
] as const;

export type AiWorkflowKind = (typeof AI_WORKFLOW_KINDS)[number];
export type AiWorkflowStatus =
  | "queued"
  | "starting"
  | "running"
  | "core_completed"
  | "completed"
  | "failed"
  | "cancelled";

export const AI_WORKFLOW_MAX_ATTEMPTS = 3;
export const RETRYABLE_WORKFLOW_FAILURE_CODE = "RETRYABLE_WORKFLOW_FAILED";

export interface AiWorkflowRun {
  id: string;
  workflow_kind: AiWorkflowKind;
  analysis_job_id: string | null;
  speaking_response_id: string | null;
  writing_response_id: string | null;
  user_id: string;
  idempotency_key: string;
  workflow_run_id: string | null;
  launch_token: string | null;
  status: AiWorkflowStatus;
  phase: string;
  provider_attempt_count: number;
  workflow_attempt_count: number;
  lease_expires_at: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  progress: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  started_at: string | null;
  core_completed_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
}

type WorkflowSource =
  | { kind: "practice_analysis"; analysisJobId: string }
  | { kind: "ielts_speaking_score"; speakingResponseId: string }
  | { kind: "ielts_writing_score"; writingResponseId: string };

export function isDurableAiWorkflowsEnabled(): boolean {
  return process.env.AI_DURABLE_WORKFLOWS_ENABLED === "true";
}

function sourceId(source: WorkflowSource): string {
  if (source.kind === "practice_analysis") return source.analysisJobId;
  if (source.kind === "ielts_speaking_score") return source.speakingResponseId;
  return source.writingResponseId;
}

export function createAiWorkflowIdempotencyKey(source: WorkflowSource): string {
  return `ai-workflow:${source.kind}:${sourceId(source)}:v1`;
}

/**
 * Creates the product-facing record once per domain object. It intentionally
 * treats a concurrent unique-key insert as a read: Workflow launch can be
 * retried safely by an at-least-once queue delivery.
 */
export async function ensureAiWorkflowRun(params: {
  source: WorkflowSource;
  userId: string;
}): Promise<AiWorkflowRun> {
  const supabase = createAdminClient();
  const key = createAiWorkflowIdempotencyKey(params.source);
  const { data: existing, error: existingError } = await supabase
    .from("ai_workflow_runs")
    .select("*")
    .eq("idempotency_key", key)
    .maybeSingle();

  if (existingError) {
    throw new Error(`load AI workflow run: ${existingError.message}`);
  }
  if (existing) return existing as AiWorkflowRun;

  const insert = {
    workflow_kind: params.source.kind,
    user_id: params.userId,
    idempotency_key: key,
    analysis_job_id:
      params.source.kind === "practice_analysis"
        ? params.source.analysisJobId
        : null,
    speaking_response_id:
      params.source.kind === "ielts_speaking_score"
        ? params.source.speakingResponseId
        : null,
    writing_response_id:
      params.source.kind === "ielts_writing_score"
        ? params.source.writingResponseId
        : null,
  };
  const { data, error } = await supabase
    .from("ai_workflow_runs")
    .insert(insert)
    .select("*")
    .maybeSingle();

  if (data) return data as AiWorkflowRun;
  if (!error) throw new Error("create AI workflow run returned no row");

  const { data: afterConflict, error: conflictError } = await supabase
    .from("ai_workflow_runs")
    .select("*")
    .eq("idempotency_key", key)
    .single();
  if (conflictError || !afterConflict) {
    throw new Error(`create AI workflow run: ${error.message}`);
  }
  return afterConflict as AiWorkflowRun;
}

export async function recordAiWorkflowLaunch(params: {
  id: string;
  workflowRunId: string;
  launchToken: string;
}): Promise<void> {
  const { error } = await createAdminClient()
    .from("ai_workflow_runs")
    .update({
      workflow_run_id: params.workflowRunId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .eq("launch_token", params.launchToken);
  if (error) throw new Error(`record AI workflow launch: ${error.message}`);
}

export async function claimAiWorkflowRun(params: {
  id: string;
  phase: string;
  leaseSeconds?: number;
  launchToken?: string;
}): Promise<AiWorkflowRun | null> {
  const { data, error } = await createAdminClient().rpc(
    "claim_ai_workflow_run",
    {
      p_run_id: params.id,
      p_phase: params.phase,
      p_lease_seconds: params.leaseSeconds ?? 900,
      p_launch_token: params.launchToken ?? null,
    }
  );
  if (error) throw new Error(`claim AI workflow run: ${error.message}`);
  return Array.isArray(data) && data.length > 0
    ? (data[0] as AiWorkflowRun)
    : null;
}

export function isRetryableWorkflowFailure(run: Pick<
  AiWorkflowRun,
  "status" | "last_error_code" | "workflow_attempt_count"
>): boolean {
  return (
    run.status === "failed" &&
    run.last_error_code === RETRYABLE_WORKFLOW_FAILURE_CODE &&
    run.workflow_attempt_count < AI_WORKFLOW_MAX_ATTEMPTS
  );
}

/**
 * Called immediately before an actual model-provider request. This is a
 * database-side increment so concurrent fallback/retry paths cannot lose a
 * cost/attempt observation.
 */
export async function incrementAiWorkflowProviderAttempt(
  workflowRunId: string
): Promise<void> {
  const { error } = await createAdminClient().rpc(
    "increment_ai_workflow_provider_attempt",
    { p_run_id: workflowRunId }
  );
  if (error) {
    throw new Error(`increment AI workflow provider attempt: ${error.message}`);
  }
}

export async function updateAiWorkflowRun(params: {
  id: string;
  status?: AiWorkflowStatus;
  phase?: string;
  progress?: Record<string, unknown>;
  errorCode?: string | null;
  errorMessage?: string | null;
  coreCompleted?: boolean;
  completed?: boolean;
  failed?: boolean;
  /**
   * Prevent a late/retried workflow step from overwriting a terminal state.
   * A guarded update that affects no rows is an expected idempotent no-op.
   */
  expectedStatuses?: AiWorkflowStatus[];
}): Promise<void> {
  const now = new Date().toISOString();
  const update = {
    ...(params.status ? { status: params.status } : {}),
    ...(params.phase ? { phase: params.phase } : {}),
    ...(params.progress ? { progress: params.progress } : {}),
    ...(params.errorCode !== undefined
      ? { last_error_code: params.errorCode }
      : {}),
    ...(params.errorMessage !== undefined
      ? { last_error_message: params.errorMessage?.slice(0, 1000) ?? null }
      : {}),
    ...(params.coreCompleted ? { core_completed_at: now } : {}),
    ...(params.completed ? { completed_at: now, lease_expires_at: null } : {}),
    ...(params.failed ? { failed_at: now, lease_expires_at: null } : {}),
    updated_at: now,
  };
  let query = createAdminClient()
    .from("ai_workflow_runs")
    .update(update)
    .eq("id", params.id);
  if (params.expectedStatuses?.length) {
    query = query.in("status", params.expectedStatuses);
  }
  const { error } = await query;
  if (error) throw new Error(`update AI workflow run: ${error.message}`);
}
