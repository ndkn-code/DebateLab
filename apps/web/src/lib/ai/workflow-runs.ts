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

export type WorkflowSource =
  | { kind: "practice_analysis"; analysisJobId: string }
  | { kind: "ielts_speaking_score"; speakingResponseId: string }
  | { kind: "ielts_writing_score"; writingResponseId: string };

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
 * treats a concurrent unique-key insert as a read: Pub/Sub publication can be
 * retried safely by an at-least-once submission.
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

export async function markAiWorkflowRunPublished(params: {
  id: string;
  messageId: string;
}): Promise<void> {
  const { error } = await createAdminClient()
    .from("ai_workflow_runs")
    .update({
      backend: "gcp_pubsub",
      backend_message_id: params.messageId,
      published_at: new Date().toISOString(),
      phase: "published",
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.id)
    .in("status", ["queued", "failed", "starting"]);
  if (error) throw new Error(`mark AI workflow run published: ${error.message}`);
}

export async function markAiWorkflowRunPublishing(id: string): Promise<void> {
  const { error } = await createAdminClient()
    .from("ai_workflow_runs")
    .update({
      backend: "gcp_pubsub",
      phase: "publishing",
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .in("status", ["queued", "failed", "starting"]);
  if (error) throw new Error(`mark AI workflow run publishing: ${error.message}`);
}
