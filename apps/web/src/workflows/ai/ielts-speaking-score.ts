import {
  claimWorkflowCore,
  markWorkflowCompleted,
  markWorkflowCoreCompleted,
  markWorkflowFailed,
  markSpeakingWorkflowFailure,
  claimIeltsSpeakingScore,
  generateIeltsSpeakingScore,
  persistIeltsSpeakingScore,
  prepareIeltsSpeakingScore,
  recomputeSpeakingAttempt,
  replanSpeakingAttempt,
} from "./steps";
import { FatalError } from "workflow";

export interface IeltsSpeakingScoreWorkflowInput {
  workflowRunId: string;
  launchToken: string;
  speakingResponseId: string;
  durationSeconds?: number;
}

/** Durable IELTS speaking scoring: the score is persisted before optional replanning. */
export async function ieltsSpeakingScoreWorkflow(
  input: IeltsSpeakingScoreWorkflowInput
) {
  "use workflow";

  const claimed = await claimWorkflowCore(
    input.workflowRunId,
    "speaking_scoring",
    input.launchToken
  );
  if (!claimed) return { status: "already_running" as const };

  try {
    const claim = await claimIeltsSpeakingScore({
      speakingResponseId: input.speakingResponseId,
    });
    if (claim.status === "already_scored") {
      await markWorkflowCoreCompleted(input.workflowRunId, "speaking_already_scored");
      await markWorkflowCompleted(input.workflowRunId);
      return { status: "already_scored" as const };
    }
    const prepared = await prepareIeltsSpeakingScore(input);
    const generated = await generateIeltsSpeakingScore({
      workflowRunId: input.workflowRunId,
      speakingResponseId: prepared.speakingResponseId,
      userId: prepared.userId,
      prompt: prepared.prompt,
    });
    const scored = await persistIeltsSpeakingScore({
      speakingResponseId: prepared.speakingResponseId,
      attemptId: prepared.attemptId,
      userId: prepared.userId,
      transcript: prepared.transcript,
      sttProvider: prepared.sttProvider,
      phonemeReport: prepared.phonemeReport,
      output: generated.output,
      provider: generated.provider,
      model: generated.model,
    });
    await recomputeSpeakingAttempt(scored.attemptId, scored.userId);
    await markWorkflowCoreCompleted(input.workflowRunId, "speaking_scored");

    // Adaptive replanning is never allowed to roll back a learner's score.
    try {
      await replanSpeakingAttempt({
        userId: scored.userId,
        speakingResponseId: input.speakingResponseId,
      });
    } catch {
      // The durable score is already visible. The scheduled replan process can
      // reconcile this non-critical follow-up later.
    }
    await markWorkflowCompleted(input.workflowRunId);
    return { status: "completed" as const };
  } catch (error) {
    const retryable = !(error instanceof FatalError);
    const message = error instanceof Error ? error.message : String(error);
    await markSpeakingWorkflowFailure({
      speakingResponseId: input.speakingResponseId,
      retryable,
    }).catch(() => undefined);
    await markWorkflowFailed(input.workflowRunId, message, retryable);
    throw error;
  }
}
