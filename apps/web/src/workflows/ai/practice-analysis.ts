import {
  claimWorkflowCore,
  claimPracticeAnalysis,
  markPracticeWorkflowFailure,
  markWorkflowCompleted,
  markWorkflowCoreCompleted,
  markWorkflowFailed,
  generatePracticeAnalysis,
  persistPracticeAnalysis,
  preparePracticeAnalysis,
} from "./steps";
import { FatalError } from "workflow";

export interface PracticeAnalysisWorkflowInput {
  workflowRunId: string;
  launchToken: string;
  analysisJobId: string;
  practiceAttemptId: string;
}

/** Durable wrapper around the existing debate evaluator and persistence contract. */
export async function practiceAnalysisWorkflow(input: PracticeAnalysisWorkflowInput) {
  "use workflow";

  const claimed = await claimWorkflowCore(
    input.workflowRunId,
    "practice_scoring",
    input.launchToken
  );
  if (!claimed) return { status: "already_running" as const };

  try {
    const analysisClaim = await claimPracticeAnalysis(input);
    if (analysisClaim.status !== "claimed") {
      await markWorkflowCoreCompleted(input.workflowRunId, "practice_already_handled");
      await markWorkflowCompleted(input.workflowRunId);
      return { status: analysisClaim.status };
    }
    const prepared = await preparePracticeAnalysis(input);
    if (prepared.status !== "prepared") {
      await markWorkflowCoreCompleted(input.workflowRunId, "practice_already_handled");
      await markWorkflowCompleted(input.workflowRunId);
      return { status: prepared.status };
    }
    const feedback = await generatePracticeAnalysis({
      input: prepared.input,
      userId: prepared.userId,
    });
    const result = await persistPracticeAnalysis({
      jobId: prepared.jobId,
      attemptId: prepared.attemptId,
      workflowRunId: input.workflowRunId,
      feedback,
    });
    if (result.status === "completed" || result.status === "already_completed") {
      await markWorkflowCoreCompleted(input.workflowRunId, "practice_scored");
    }
    await markWorkflowCompleted(input.workflowRunId);
    return { status: "completed" as const };
  } catch (error) {
    const retryable = !(error instanceof FatalError);
    const message = error instanceof Error ? error.message : String(error);
    if (!retryable) {
      await markPracticeWorkflowFailure({
        analysisJobId: input.analysisJobId,
        practiceAttemptId: input.practiceAttemptId,
        errorMessage: message,
      }).catch(() => undefined);
    }
    await markWorkflowFailed(
      input.workflowRunId,
      message,
      retryable
    );
    throw error;
  }
}
