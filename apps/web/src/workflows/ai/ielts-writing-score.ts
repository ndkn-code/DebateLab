import {
  claimWorkflowCore,
  markWorkflowCompleted,
  markWorkflowCoreCompleted,
  markWorkflowFailed,
  markWritingWorkflowFailure,
  claimIeltsWritingScore,
  adjudicateIeltsWritingScore,
  generateIeltsWritingScore,
  persistIeltsWritingScore,
  prepareIeltsWritingScore,
  recomputeWritingAttempt,
  replanWritingAttempt,
} from "./steps";
import { FatalError } from "workflow";
import {
  IELTS_GRADING_VERSION,
  isIeltsEvidenceAdjudicationEnabled,
} from "@/lib/ielts/scoring-adjudication";
import {
  buildWritingCriterionEvidence,
  IELTS_PROVISIONAL_EVIDENCE_VERSION,
} from "@/lib/ielts/criterion-evidence-contract";
import { normalizeWritingScore } from "@/lib/scoring/ielts-writing/normalize";

export interface IeltsWritingScoreWorkflowInput {
  workflowRunId: string;
  launchToken: string;
  writingResponseId: string;
}

/** Durable IELTS writing scoring: scoring, band aggregation, then optional replan. */
export async function ieltsWritingScoreWorkflow(
  input: IeltsWritingScoreWorkflowInput,
) {
  "use workflow";

  const claimed = await claimWorkflowCore(
    input.workflowRunId,
    "writing_scoring",
    input.launchToken,
  );
  if (!claimed) return { status: "already_running" as const };

  try {
    const claim = await claimIeltsWritingScore({
      writingResponseId: input.writingResponseId,
    });
    if (claim.status === "already_scored") {
      await markWorkflowCoreCompleted(
        input.workflowRunId,
        "writing_already_scored",
      );
      await markWorkflowCompleted(input.workflowRunId);
      return { status: "already_scored" as const };
    }
    const prepared = await prepareIeltsWritingScore(input);
    const generated = await generateIeltsWritingScore({
      workflowRunId: input.workflowRunId,
      writingResponseId: prepared.writingResponseId,
      userId: prepared.userId,
      prompt: prepared.prompt,
    });
    const adjudicated = isIeltsEvidenceAdjudicationEnabled()
      ? await adjudicateIeltsWritingScore({
          workflowRunId: input.workflowRunId,
          writingResponseId: prepared.writingResponseId,
          userId: prepared.userId,
          questionId: prepared.questionId,
          questionType: prepared.questionType,
          retrievalQuery: prepared.retrievalQuery,
          prompt: prepared.prompt,
          provisionalOutput: generated.output,
          provisionalTraceId: generated.traceId,
          baseEvidence: prepared.baseEvidence,
          baseCorpusVersion: prepared.baseCorpusVersion,
        })
      : { ...generated, gradingMetadata: undefined };
    const criterionEvidence = buildWritingCriterionEvidence({
      score: normalizeWritingScore(generated.output),
      context: {
        stage: "provisional",
        gradingVersion: IELTS_PROVISIONAL_EVIDENCE_VERSION,
        traceId: generated.traceId,
        runId: input.workflowRunId,
        provider: generated.provider,
        model: generated.model,
      },
    });
    if (adjudicated.gradingMetadata)
      criterionEvidence.push(
        ...buildWritingCriterionEvidence({
          score: normalizeWritingScore(adjudicated.output),
          context: {
            stage: "adjudicated",
            gradingVersion: IELTS_GRADING_VERSION,
            traceId: adjudicated.traceId,
            runId: input.workflowRunId,
            provider: adjudicated.provider,
            model: adjudicated.model,
          },
        }),
      );
    const scored = await persistIeltsWritingScore({
      writingResponseId: prepared.writingResponseId,
      attemptId: prepared.attemptId,
      userId: prepared.userId,
      output: adjudicated.output,
      provider: adjudicated.provider,
      model: adjudicated.model,
      gradingMetadata: adjudicated.gradingMetadata,
      criterionEvidence,
    });
    await recomputeWritingAttempt(scored.attemptId, scored.userId);
    await markWorkflowCoreCompleted(input.workflowRunId, "writing_scored");
    try {
      await replanWritingAttempt({
        userId: scored.userId,
        writingResponseId: input.writingResponseId,
      });
    } catch {
      // Replanning is best-effort and must not cause a score retry.
    }
    await markWorkflowCompleted(input.workflowRunId);
    return { status: "completed" as const };
  } catch (error) {
    const retryable = !(error instanceof FatalError);
    const message = error instanceof Error ? error.message : String(error);
    await markWritingWorkflowFailure({
      writingResponseId: input.writingResponseId,
      retryable,
    }).catch(() => undefined);
    await markWorkflowFailed(input.workflowRunId, message, retryable);
    throw error;
  }
}
