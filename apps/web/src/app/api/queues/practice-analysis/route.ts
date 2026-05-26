import { QueueClient } from "@vercel/queue";
import type { VercelRegion } from "@vercel/queue";
import { recordAnalyticsEvent } from "@/lib/analytics/server-events";
import {
  getPracticeFeedbackModelName,
  getPracticeFeedbackModelProvider,
  PRACTICE_FEEDBACK_PROMPT_BUNDLE_KEY,
  PRACTICE_FEEDBACK_PROMPT_BUNDLE_VERSION,
  PRACTICE_FEEDBACK_RUBRIC_VERSION,
} from "@/lib/practice-analysis/constants";
import { recordAiQualityRun } from "@/lib/ai/quality";
import type { AiQualityTelemetry } from "@/lib/ai/quality-model";
import {
  createDebateCorpusRetrievalMetadata,
  type DebateCorpusRetrievalCacheEntry,
  linkDebateCorpusRetrievalLogToAiRun,
  retrieveDebateCorpusContext,
} from "@/lib/corpus/retrieval";
import { evaluatePracticeFeedback } from "@/lib/practice-analysis/evaluators";
import { saveCompletedPracticeAttempt } from "@/lib/practice-analysis/persistence";
import {
  getAnalysisJobForProcessing,
  markPracticeAnalysisCompleted,
  markPracticeAnalysisFailed,
  markPracticeAnalysisProcessing,
  practiceAttemptRowToInput,
} from "@/lib/practice-analysis/service";
import type { PracticeAnalysisQueueMessage } from "@/lib/practice-analysis/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createTranscriptionQualityMetadata } from "@/lib/stt/prompt";

export const maxDuration = 60;

const queue = new QueueClient({
  region: (process.env.VERCEL_REGION || "sin1") as VercelRegion,
  ...(process.env.VERCEL_QUEUE_API_TOKEN
    ? { deploymentId: null, token: process.env.VERCEL_QUEUE_API_TOKEN }
    : {}),
});

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function readCorpusRetrievalCache(
  value: Record<string, unknown> | null
): DebateCorpusRetrievalCacheEntry | null {
  const cache = value?.corpusRetrievalCache;
  if (!cache || typeof cache !== "object" || Array.isArray(cache)) return null;
  const source = cache as Partial<DebateCorpusRetrievalCacheEntry>;
  return source.schemaVersion === 1 &&
    typeof source.cacheKey === "string" &&
    source.result &&
    typeof source.result === "object"
    ? (source as DebateCorpusRetrievalCacheEntry)
    : null;
}

export const POST = queue.handleCallback<PracticeAnalysisQueueMessage>(
  async (message, metadata) => {
    const supabase = createAdminClient();
    const { job, attempt } = await getAnalysisJobForProcessing(
      supabase,
      message.jobId,
      message.attemptId
    );

    if (job.status === "completed" && attempt.status === "completed") {
      return;
    }

    if (job.status === "cancelled") {
      return;
    }

    await markPracticeAnalysisProcessing(supabase, {
      jobId: job.id,
      attemptId: attempt.id,
      deliveryCount: metadata.deliveryCount,
    });

    try {
      const input = practiceAttemptRowToInput(attempt);
      let corpusRetrievalCache =
        readCorpusRetrievalCache(job.result);
      const corpusRetrieval = await retrieveDebateCorpusContext({
        purpose: "judging",
        practiceLanguage: input.practiceLanguage,
        practiceTrack: input.practiceTrack,
        topic: input.topic,
        side: input.side,
        transcript: input.transcript,
        roundsText: input.rounds?.map(
          (round) => round.transcript || round.aiResponse || ""
        ),
        userId: attempt.user_id,
        sourceRoute: "/api/queues/practice-analysis",
        supabase,
        cacheEntry: corpusRetrievalCache,
        onCacheEntry: async (entry) => {
          corpusRetrievalCache = entry;
          await supabase
            .from("analysis_jobs")
            .update({
              result: {
                ...(job.result ?? {}),
                corpusRetrievalCache: entry,
              },
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id);
        },
      });
      let telemetry: AiQualityTelemetry | null = null;
      const feedback = await evaluatePracticeFeedback(
        {
          ...input,
          corpusContext: corpusRetrieval.contextBlock,
        },
        attempt.user_id,
        (nextTelemetry) => {
          telemetry = nextTelemetry;
        }
      );
      const modelName = getPracticeFeedbackModelName(input.practiceTrack);
      const savedSession = await saveCompletedPracticeAttempt(supabase, {
        attempt,
        feedback,
        modelName,
      });
      const aiQualityTelemetry = telemetry as AiQualityTelemetry | null;
      const transcriptionMetadata = input.transcription
        ? createTranscriptionQualityMetadata(input.transcription)
        : null;
      const aiQualityRunId = aiQualityTelemetry
        ? await recordAiQualityRun(supabase, {
            ...aiQualityTelemetry,
            userId: attempt.user_id,
            outputType: "practice_judging",
            sourceRoute: "/api/queues/practice-analysis",
            promptBundleKey: attempt.prompt_bundle_key ?? PRACTICE_FEEDBACK_PROMPT_BUNDLE_KEY,
            promptBundleVersion:
              attempt.prompt_bundle_version ?? PRACTICE_FEEDBACK_PROMPT_BUNDLE_VERSION,
            promptHash: attempt.prompt_hash,
            rubricKey: attempt.rubric_key,
            rubricVersion: attempt.rubric_version ?? PRACTICE_FEEDBACK_RUBRIC_VERSION,
            practiceTrack: attempt.practice_track,
            practiceLanguage: attempt.practice_language,
            difficulty: attempt.ai_difficulty ?? attempt.topic_difficulty,
            debateFormat: attempt.mode,
            side: attempt.side,
            topicTitle: attempt.topic_title,
            winner: feedback.debateVerdict?.winner ?? null,
            score: feedback.totalScore,
            confidence: feedback.debateVerdict?.confidence ?? null,
            outputText: JSON.stringify(feedback),
            inputPreview: attempt.transcript,
            practiceAttemptId: attempt.id,
            analysisJobId: job.id,
            debateSessionId: savedSession.sessionId,
            metadata: {
              ...(aiQualityTelemetry.metadata ?? {}),
              speechType: input.speechType,
              isFullRound: input.isFullRound,
              roundCount: input.rounds?.length ?? 0,
              queueMessageId: metadata.messageId,
              transcription: transcriptionMetadata ?? undefined,
              sttSelectedProvider:
                transcriptionMetadata?.sttSelectedProvider ?? null,
              sttShadowProvider:
                transcriptionMetadata?.sttShadowProvider ?? null,
              sttShadowRejectedReason:
                transcriptionMetadata?.sttShadowRejectedReason ?? null,
              ...createDebateCorpusRetrievalMetadata(corpusRetrieval),
              annotationAcceptedCount:
                feedback.annotationMetadata?.acceptedCount ?? null,
              annotationRejectedCount:
                feedback.annotationMetadata?.rejectedCount ?? null,
              annotationRepairUsed:
                feedback.annotationMetadata?.repairUsed ?? false,
              annotationFallbackUsed:
                feedback.annotationMetadata?.fallbackUsed ?? false,
            },
          })
        : null;
      await linkDebateCorpusRetrievalLogToAiRun(
        corpusRetrieval.logId,
        aiQualityRunId,
        supabase
      );

      await markPracticeAnalysisCompleted(supabase, {
        attemptId: attempt.id,
        jobId: job.id,
        feedback,
        modelName,
        legacySessionId: savedSession.sessionId,
        aiQualityRunId,
        resultMetadata: corpusRetrievalCache
          ? { corpusRetrievalCache }
          : undefined,
      });

      await recordAnalyticsEvent(supabase, attempt.user_id, {
        eventName: "ai_feedback_completed",
        featureArea: "ai_feedback",
        durationMs: attempt.duration_seconds
          ? attempt.duration_seconds * 1000
          : null,
        metadata: {
          topic: attempt.topic_title,
          side: attempt.side,
          speech_type: input.speechType,
          practice_track: attempt.practice_track,
          practice_language: attempt.practice_language,
          model: modelName,
          practice_attempt_id: attempt.id,
          analysis_job_id: job.id,
          queue_message_id: metadata.messageId,
          corpus_rag_enabled: corpusRetrieval.enabled,
          retrieved_corpus_count: corpusRetrieval.items.length,
          candidate_corpus_count: corpusRetrieval.candidateItems.length,
          corpus_rag_skipped_reason: corpusRetrieval.skippedReason,
          corpus_rag_top_similarity: corpusRetrieval.topSimilarity,
          corpus_rag_relevance_gate_passed: corpusRetrieval.relevanceGatePassed,
        },
      });
    } catch (error) {
      await recordAiQualityRun(supabase, {
        userId: attempt.user_id,
        outputType: "practice_judging",
        status: "error",
        sourceRoute: "/api/queues/practice-analysis",
        provider: getPracticeFeedbackModelProvider(attempt.practice_track),
        requestedProvider: getPracticeFeedbackModelProvider(attempt.practice_track),
        model: getPracticeFeedbackModelName(attempt.practice_track),
        promptBundleKey: attempt.prompt_bundle_key ?? PRACTICE_FEEDBACK_PROMPT_BUNDLE_KEY,
        promptBundleVersion:
          attempt.prompt_bundle_version ?? PRACTICE_FEEDBACK_PROMPT_BUNDLE_VERSION,
        promptHash: attempt.prompt_hash,
        rubricKey: attempt.rubric_key,
        rubricVersion: attempt.rubric_version ?? PRACTICE_FEEDBACK_RUBRIC_VERSION,
        practiceTrack: attempt.practice_track,
        practiceLanguage: attempt.practice_language,
        difficulty: attempt.ai_difficulty ?? attempt.topic_difficulty,
        debateFormat: attempt.mode,
        side: attempt.side,
        topicTitle: attempt.topic_title,
        latencyMs: null,
        errorCode: "ANALYSIS_FAILED",
        errorMessage: getErrorMessage(error).slice(0, 1000),
        inputPreview: attempt.transcript,
        practiceAttemptId: attempt.id,
        analysisJobId: job.id,
        metadata: {
          queueMessageId: metadata.messageId,
          deliveryCount: metadata.deliveryCount,
          transcription: attempt.attempt_snapshot.analysisParams.transcription
            ? createTranscriptionQualityMetadata(
                attempt.attempt_snapshot.analysisParams.transcription
              )
            : undefined,
        },
      }).catch(() => null);
      const deliveryLimit = job.max_attempts || 3;
      const retryAfterSeconds =
        metadata.deliveryCount >= deliveryLimit
          ? undefined
          : Math.min(300, 2 ** metadata.deliveryCount * 5);
      await markPracticeAnalysisFailed(supabase, {
        jobId: job.id,
        attemptId: attempt.id,
        errorCode: "ANALYSIS_FAILED",
        errorMessage: getErrorMessage(error).slice(0, 1000),
        retryAfterSeconds,
      }).catch(() => {});
      throw error;
    }
  },
  {
    visibilityTimeoutSeconds: 60,
    retry: (_error, metadata) => {
      if (metadata.deliveryCount >= 3) return { acknowledge: true };
      return { afterSeconds: Math.min(300, 2 ** metadata.deliveryCount * 5) };
    },
  }
);
