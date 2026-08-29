import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  AI_WORKFLOW_MAX_ATTEMPTS,
  RETRYABLE_WORKFLOW_FAILURE_CODE,
  isDurableAiWorkflowsEnabled,
  updateAiWorkflowRun,
} from "@/lib/ai/workflow-runs";
import {
  launchIeltsSpeakingScoreWorkflow,
  launchIeltsWritingScoreWorkflow,
  launchPracticeAnalysisWorkflow,
} from "@/lib/ai/workflow-launcher";
import { markSpeakingScoringFailed } from "@/lib/api/ielts/speaking-responses-repository";
import { markWritingScoringFailed } from "@/lib/api/ielts/writing-responses-repository";
import { failDurablePracticeAnalysis } from "@/lib/practice-analysis/durable-runner";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const LIMIT = 100;

type ReconcileRun = {
  id: string;
  workflow_kind: "practice_analysis" | "ielts_speaking_score" | "ielts_writing_score";
  analysis_job_id: string | null;
  speaking_response_id: string | null;
  writing_response_id: string | null;
  workflow_run_id: string | null;
  status: "queued" | "starting" | "failed";
  last_error_code: string | null;
  workflow_attempt_count: number;
  updated_at: string;
};

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  return Boolean(secret) && request.headers.get("authorization") === `Bearer ${secret}`;
}

async function finalizeExhaustedRetry(run: ReconcileRun) {
  const admin = createAdminClient();
  if (run.workflow_kind === "practice_analysis" && run.analysis_job_id) {
    const { data, error } = await admin
      .from("analysis_jobs")
      .select("attempt_id")
      .eq("id", run.analysis_job_id)
      .maybeSingle();
    if (error || !data?.attempt_id) {
      throw new Error(`load exhausted practice workflow source: ${error?.message ?? "missing attempt"}`);
    }
    await failDurablePracticeAnalysis({
      jobId: run.analysis_job_id,
      attemptId: data.attempt_id,
      errorMessage: "AI analysis could not be completed after several temporary failures.",
    });
  } else if (run.workflow_kind === "ielts_speaking_score" && run.speaking_response_id) {
    await markSpeakingScoringFailed(admin, {
      speakingResponseId: run.speaking_response_id,
      retryable: false,
    });
  } else if (run.workflow_kind === "ielts_writing_score" && run.writing_response_id) {
    await markWritingScoringFailed(admin, {
      writingResponseId: run.writing_response_id,
      retryable: false,
    });
  }
  await updateAiWorkflowRun({
    id: run.id,
    status: "failed",
    phase: "failed",
    errorCode: "WORKFLOW_RETRY_EXHAUSTED",
    errorMessage: "Durable workflow retry limit exhausted.",
    failed: true,
    expectedStatuses: ["failed"],
  });
}

/**
 * Repairs the small crash window between persisting an application workflow
 * record and starting its Vercel Workflow run. It never re-runs a recorded
 * workflow_run_id; duplicate starts before that write are harmless because the
 * workflow's first step atomically claims the app-level record.
 */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isDurableAiWorkflowsEnabled()) {
    return NextResponse.json({ ok: true, enabled: false, launched: 0 });
  }

  const staleStartingBefore = new Date(Date.now() - 3 * 60_000).toISOString();
  const { data, error } = await createAdminClient()
    .from("ai_workflow_runs")
    .select("id, workflow_kind, analysis_job_id, speaking_response_id, writing_response_id, workflow_run_id, status, last_error_code, workflow_attempt_count, updated_at")
    .in("status", ["queued", "starting", "failed"])
    .order("created_at", { ascending: true })
    .limit(LIMIT);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  let launched = 0;
  let failed = 0;
  let exhausted = 0;
  const candidates = ((data ?? []) as ReconcileRun[]).filter((run) =>
    (run.status === "queued" && !run.workflow_run_id) ||
    (run.status === "starting" && !run.workflow_run_id && run.updated_at < staleStartingBefore) ||
    (run.status === "failed" && run.last_error_code === RETRYABLE_WORKFLOW_FAILURE_CODE)
  );
  for (const run of candidates) {
    try {
      if (
        run.status === "failed" &&
        run.workflow_attempt_count >= AI_WORKFLOW_MAX_ATTEMPTS
      ) {
        await finalizeExhaustedRetry(run);
        exhausted += 1;
        continue;
      }
      if (run.workflow_kind === "practice_analysis" && run.analysis_job_id) {
        await launchPracticeAnalysisWorkflow({
          analysisJobId: run.analysis_job_id,
        });
      } else if (run.workflow_kind === "ielts_speaking_score" && run.speaking_response_id) {
        await launchIeltsSpeakingScoreWorkflow({
          speakingResponseId: run.speaking_response_id,
        });
      } else if (run.workflow_kind === "ielts_writing_score" && run.writing_response_id) {
        await launchIeltsWritingScoreWorkflow({
          writingResponseId: run.writing_response_id,
        });
      }
      launched += 1;
    } catch (launchError) {
      failed += 1;
      console.error("AI workflow reconciliation launch failed", launchError);
    }
  }
  return NextResponse.json({ ok: true, enabled: true, launched, exhausted, failed });
}
