import "server-only";

import { evaluatePracticeFeedback } from "./evaluators";
import {
  getAnalysisJobForProcessing,
  markPracticeAnalysisCompleted,
  markPracticeAnalysisFailed,
  markPracticeAnalysisProcessing,
  practiceAttemptRowToInput,
} from "./service";
import { saveCompletedPracticeAttempt } from "./persistence";
import {
  getPracticeFeedbackModelName,
  getPracticeFeedbackModelProvider,
} from "./constants";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  retrieveEnglishDebateKnowledge,
  searchKnowledge,
} from "@/lib/ai/knowledge";
import { selectTranscriptForJudging } from "@/lib/stt/repair";

/**
 * Checkpoint retrieval separately from paid generation. Its output is plain
 * data, so Workflow can replay a persistence step without re-running a model.
 */
export async function prepareDurablePracticeAnalysis(params: {
  jobId: string;
  attemptId: string;
  workflowRunId: string;
}) {
  const supabase = createAdminClient();
  const { job, attempt } = await getAnalysisJobForProcessing(
    supabase,
    params.jobId,
    params.attemptId,
  );
  if (job.status === "completed" || attempt.status === "completed") {
    return { status: "already_completed" as const };
  }
  if (job.status !== "processing" || attempt.status !== "analyzing") {
    return { status: "terminal" as const };
  }

  const input = practiceAttemptRowToInput(attempt);
  const judgingTranscript = selectTranscriptForJudging({
    transcript: input.transcript,
    transcription: input.transcription,
    practiceLanguage: input.practiceLanguage,
    practiceTrack: input.practiceTrack,
  });
  // English competitive debate has its own collection and embedding model. Do
  // not route it through the Vietnamese Trường Teen corpus (and retain that
  // exact legacy retrieval path for Vietnamese/speaking practice).
  const englishKnowledge = await retrieveEnglishDebateKnowledge({
    purpose: "grading",
    language: input.practiceLanguage,
    practiceTrack: input.practiceTrack,
    topic: input.topic,
    side: input.side,
    transcript: judgingTranscript,
    roundsText: input.rounds?.map(
      (round) => round.transcript || round.aiResponse || "",
    ),
    userId: attempt.user_id,
    sourceRoute: "/workflows/ai/practice-analysis",
  });
  const knowledge = englishKnowledge
    ? null
    : await searchKnowledge({
        collection: "debate",
        purpose: "grading",
        debatePurpose: "judging",
        language: input.practiceLanguage,
        practiceTrack: input.practiceTrack,
        topic: input.topic,
        side: input.side,
        query: judgingTranscript,
        roundsText: input.rounds?.map(
          (round) => round.transcript || round.aiResponse || "",
        ),
        userId: attempt.user_id,
        sourceRoute: "/workflows/ai/practice-analysis",
        supabase,
      });
  const retrieval = knowledge?.data;
  return {
    status: "prepared" as const,
    attemptId: attempt.id,
    jobId: job.id,
    userId: attempt.user_id,
    practiceTrack: attempt.practice_track,
    input: {
      ...input,
      transcript: judgingTranscript,
      corpusContext: englishKnowledge?.contextBlock ?? retrieval?.contextBlock,
      providerAudit: {
        sourceRoute: "/workflows/ai/practice-analysis",
        practiceAttemptId: attempt.id,
        analysisJobId: job.id,
        metadata: {
          workflowRunId: params.workflowRunId,
          ...(englishKnowledge
            ? {
                knowledgeProvenance: englishKnowledge.provenance,
                knowledgeEvidence: englishKnowledge.evidence,
                knowledgeSkippedReason: englishKnowledge.skippedReason ?? null,
              }
            : {}),
        },
      },
    },
  };
}

/** This is the only paid debate/speaking evaluator checkpoint. */
export async function generateDurablePracticeFeedback(params: {
  input: Parameters<typeof evaluatePracticeFeedback>[0];
  userId: string;
}) {
  return evaluatePracticeFeedback(params.input, params.userId);
}

/** Persist a previously checkpointed evaluator result without another model call. */
export async function persistDurablePracticeAnalysis(params: {
  jobId: string;
  attemptId: string;
  workflowRunId: string;
  feedback: Awaited<ReturnType<typeof evaluatePracticeFeedback>>;
}) {
  const supabase = createAdminClient();
  const { job, attempt } = await getAnalysisJobForProcessing(
    supabase,
    params.jobId,
    params.attemptId,
  );
  if (job.status === "completed" || attempt.status === "completed") {
    return { status: "already_completed" as const };
  }
  if (job.status !== "processing" || attempt.status !== "analyzing") {
    return { status: "terminal" as const };
  }
  const modelName = getPracticeFeedbackModelName(attempt.practice_track);
  const savedSession = await saveCompletedPracticeAttempt(supabase, {
    attempt,
    feedback: params.feedback,
    modelName,
  });
  await markPracticeAnalysisCompleted(supabase, {
    attemptId: attempt.id,
    jobId: job.id,
    feedback: params.feedback,
    modelName,
    modelProvider: getPracticeFeedbackModelProvider(attempt.practice_track),
    legacySessionId: savedSession.sessionId,
    resultMetadata: {
      workflowRunId: params.workflowRunId,
      enrichmentStatus: "pending",
    },
  });
  return { status: "completed" as const };
}

/**
 * Checkpoint the database claim before the evaluator makes any external model
 * calls. A Workflow retry can then resume the evaluator without consuming an
 * additional analysis delivery/provider-attempt budget.
 */
export async function claimDurablePracticeAnalysis(params: {
  jobId: string;
  attemptId: string;
}) {
  const supabase = createAdminClient();
  const { job, attempt } = await getAnalysisJobForProcessing(
    supabase,
    params.jobId,
    params.attemptId,
  );
  if (job.status === "completed" || attempt.status === "completed") {
    return { status: "already_completed" as const };
  }
  if (
    job.status === "cancelled" ||
    job.status === "failed" ||
    attempt.status === "failed"
  ) {
    return { status: "terminal" as const };
  }
  // This is the retry-resume path after the claim step committed but a later
  // checkpoint was interrupted. Do not turn a Workflow step retry into a new
  // queue delivery or another paid provider-attempt budget.
  if (job.status === "processing" && attempt.status === "analyzing") {
    return { status: "claimed" as const };
  }
  const claimed = await markPracticeAnalysisProcessing(supabase, {
    jobId: job.id,
    attemptId: attempt.id,
    deliveryCount: Math.min(
      (job.delivery_count ?? 0) + 1,
      job.max_attempts || 3,
    ),
    allowedStatuses: job.status === "queued" ? ["queued"] : ["processing"],
    maxAttempts: job.max_attempts || 3,
  });
  return {
    status: claimed ? ("claimed" as const) : ("already_running" as const),
  };
}

export async function failDurablePracticeAnalysis(params: {
  jobId: string;
  attemptId: string;
  errorMessage: string;
}) {
  await markPracticeAnalysisFailed(createAdminClient(), {
    jobId: params.jobId,
    attemptId: params.attemptId,
    errorCode: "DURABLE_WORKFLOW_FAILED",
    errorMessage: params.errorMessage,
  });
}
