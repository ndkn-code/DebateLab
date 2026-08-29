import "server-only";

import { start } from "workflow/api";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  claimAiWorkflowRun,
  ensureAiWorkflowRun,
  isDurableAiWorkflowsEnabled,
  recordAiWorkflowLaunch,
} from "./workflow-runs";
import { ieltsSpeakingScoreWorkflow } from "@/workflows/ai/ielts-speaking-score";
import { ieltsWritingScoreWorkflow } from "@/workflows/ai/ielts-writing-score";
import { practiceAnalysisWorkflow } from "@/workflows/ai/practice-analysis";

export async function launchPracticeAnalysisWorkflow(params: {
  analysisJobId: string;
}): Promise<string | null> {
  if (!isDurableAiWorkflowsEnabled()) return null;
  const source = await loadPracticeWorkflowSource(params.analysisJobId);
  if (!source) return "handled";
  const workflow = await ensureAiWorkflowRun({
    userId: source.userId,
    source: { kind: "practice_analysis", analysisJobId: params.analysisJobId },
  });
  if (workflow.workflow_run_id && workflow.status !== "failed") return workflow.workflow_run_id;
  const launchToken = crypto.randomUUID();
  const launchClaim = await claimAiWorkflowRun({
    id: workflow.id,
    phase: "starting",
    leaseSeconds: 120,
    launchToken,
  });
  if (!launchClaim) return workflow.workflow_run_id ?? "handled";
  try {
    const run = await start(practiceAnalysisWorkflow, [
      {
        workflowRunId: workflow.id,
        analysisJobId: params.analysisJobId,
        practiceAttemptId: source.practiceAttemptId,
        launchToken,
      },
    ]);
    await recordAiWorkflowLaunch({ id: workflow.id, workflowRunId: run.runId, launchToken });
    return run.runId;
  } catch (error) {
    await updateLaunchFailure(workflow.id, error);
    throw error;
  }
}

export async function launchIeltsSpeakingScoreWorkflow(params: {
  speakingResponseId: string;
  durationSeconds?: number;
}): Promise<string | null> {
  if (!isDurableAiWorkflowsEnabled()) return null;
  const ownerId = await loadWorkflowOwner("speaking_responses", params.speakingResponseId);
  if (!ownerId) return "handled";
  const workflow = await ensureAiWorkflowRun({
    userId: ownerId,
    source: {
      kind: "ielts_speaking_score",
      speakingResponseId: params.speakingResponseId,
    },
  });
  if (workflow.workflow_run_id && workflow.status !== "failed") return workflow.workflow_run_id;

  const launchToken = crypto.randomUUID();
  const launchClaim = await claimAiWorkflowRun({
    id: workflow.id,
    phase: "starting",
    leaseSeconds: 120,
    launchToken,
  });
  if (!launchClaim) return workflow.workflow_run_id ?? "handled";

  try {
    const run = await start(ieltsSpeakingScoreWorkflow, [
      {
        workflowRunId: workflow.id,
        speakingResponseId: params.speakingResponseId,
        durationSeconds: params.durationSeconds,
        launchToken,
      },
    ]);
    await recordAiWorkflowLaunch({ id: workflow.id, workflowRunId: run.runId, launchToken });
    return run.runId;
  } catch (error) {
    await updateLaunchFailure(workflow.id, error);
    throw error;
  }
}

export async function launchIeltsWritingScoreWorkflow(params: {
  writingResponseId: string;
}): Promise<string | null> {
  if (!isDurableAiWorkflowsEnabled()) return null;
  const ownerId = await loadWorkflowOwner("writing_responses", params.writingResponseId);
  if (!ownerId) return "handled";
  const workflow = await ensureAiWorkflowRun({
    userId: ownerId,
    source: {
      kind: "ielts_writing_score",
      writingResponseId: params.writingResponseId,
    },
  });
  if (workflow.workflow_run_id && workflow.status !== "failed") return workflow.workflow_run_id;

  const launchToken = crypto.randomUUID();
  const launchClaim = await claimAiWorkflowRun({
    id: workflow.id,
    phase: "starting",
    leaseSeconds: 120,
    launchToken,
  });
  if (!launchClaim) return workflow.workflow_run_id ?? "handled";

  try {
    const run = await start(ieltsWritingScoreWorkflow, [
      {
        workflowRunId: workflow.id,
        writingResponseId: params.writingResponseId,
        launchToken,
      },
    ]);
    await recordAiWorkflowLaunch({ id: workflow.id, workflowRunId: run.runId, launchToken });
    return run.runId;
  } catch (error) {
    await updateLaunchFailure(workflow.id, error);
    throw error;
  }
}

async function loadWorkflowOwner(
  table: "analysis_jobs" | "speaking_responses" | "writing_responses",
  id: string
): Promise<string | null> {
  const { data, error } = await createAdminClient()
    .from(table)
    .select("user_id")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`load workflow owner: ${error.message}`);
  return data?.user_id ?? null;
}

async function loadPracticeWorkflowSource(
  analysisJobId: string
): Promise<{ userId: string; practiceAttemptId: string } | null> {
  const { data, error } = await createAdminClient()
    .from("analysis_jobs")
    .select("user_id, attempt_id")
    .eq("id", analysisJobId)
    .maybeSingle();
  if (error) throw new Error(`load practice workflow source: ${error.message}`);
  if (!data?.user_id || !data.attempt_id) return null;
  return { userId: data.user_id, practiceAttemptId: data.attempt_id };
}

async function updateLaunchFailure(id: string, error: unknown): Promise<void> {
  const { updateAiWorkflowRun } = await import("./workflow-runs");
  await updateAiWorkflowRun({
    id,
    status: "failed",
    phase: "failed",
    errorCode: "RETRYABLE_WORKFLOW_FAILED",
    errorMessage: error instanceof Error ? error.message : String(error),
    failed: true,
    expectedStatuses: ["starting"],
  }).catch(() => undefined);
}
