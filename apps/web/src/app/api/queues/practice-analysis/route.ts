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
import type {
  StagedGeminiCache,
  StagedGeminiCacheEntry,
} from "@/lib/gemini";
import { saveCompletedPracticeAttempt } from "@/lib/practice-analysis/persistence";
import {
  getAnalysisJobForProcessing,
  markPracticeAnalysisCompleted,
  markPracticeAnalysisFailed,
  markPracticeAnalysisProcessing,
  practiceAttemptRowToInput,
} from "@/lib/practice-analysis/service";
import { getPracticeAnalysisRetryDecision } from "@/lib/practice-analysis/retry-guard";
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

function readStagedGeminiCache(
  value: Record<string, unknown> | null
): StagedGeminiCache | undefined {
  const cache = value?.stagedGeminiCache;
  if (!cache || typeof cache !== "object" || Array.isArray(cache)) {
    return undefined;
  }

  const normalized: StagedGeminiCache = {};
  for (const stage of [
    "speech_map",
    "verdict_feedback",
    "annotation_anchor",
  ] as const) {
    const entry = (cache as Record<string, unknown>)[stage];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      continue;
    }
    const source = entry as Partial<StagedGeminiCacheEntry>;
    if (
      source.schemaVersion === 1 &&
      source.stage === stage &&
      typeof source.modelName === "string" &&
      typeof source.promptHash === "string" &&
      typeof source.text === "string"
    ) {
      normalized[stage] = source as StagedGeminiCacheEntry;
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

export const POST = queue.handleCallback<PracticeAnalysisQueueMessage>(
  async (message, metadata) => {
    const supabase = createAdminClient();
    const { job, attempt } = await getAnalysisJobForProcessing(
      supabase,
      message.jobId,
      message.attemptId
    );

    if (job.status === "completed" || attempt.status === "completed") {
      return;
    }

    if (
      job.status === "cancelled" ||
      job.status === "failed" ||
      attempt.status === "failed"
    ) {
      return;
    }

    if (job.status === "processing" && job.finished_at) {
      await markPracticeAnalysisFailed(supabase, {
        jobId: job.id,
        attemptId: attempt.id,
        errorCode: "ANALYSIS_STALE_FINISHED_JOB",
        errorMessage:
          "Analysis job was already marked finished but never completed. The transcript is saved; please submit a new analysis if needed.",
      });
      return;
    }

    const deliveryLimit = job.max_attempts || 3;
    const retryDecision = getPracticeAnalysisRetryDecision({
      jobStatus: job.status,
      dbDeliveryCount: job.delivery_count,
      maxAttempts: deliveryLimit,
      queueDeliveryCount: metadata.deliveryCount,
      startedAt: job.started_at,
    });

    if (retryDecision.action === "fail") {
      await markPracticeAnalysisFailed(supabase, {
        jobId: job.id,
        attemptId: attempt.id,
        errorCode: "ANALYSIS_RETRY_LIMIT_EXCEEDED",
        errorMessage:
          "Analysis exceeded retry limits. The transcript is saved; please submit a new analysis if needed.",
      });
      return;
    }

    if (retryDecision.action === "skip") {
      return;
    }

    const claimed = await markPracticeAnalysisProcessing(supabase, {
      jobId: job.id,
      attemptId: attempt.id,
      deliveryCount: retryDecision.deliveryCount,
      allowedStatuses: retryDecision.allowedStatuses,
      maxAttempts: deliveryLimit,
    });
    if (!claimed) {
      return;
    }

    let effectiveProvider = getPracticeFeedbackModelProvider(attempt.practice_track);
    let effectiveModel = getPracticeFeedbackModelName(attempt.practice_track);

    try {
      const input = practiceAttemptRowToInput(attempt);
      input.providerAudit = {
        sourceRoute: "/api/queues/practice-analysis",
        practiceAttemptId: attempt.id,
        analysisJobId: job.id,
        metadata: {
          queueMessageId: metadata.messageId,
          queueDeliveryCount: metadata.deliveryCount,
          dbDeliveryCountBeforeClaim: job.delivery_count,
          effectiveDeliveryCount: retryDecision.deliveryCount,
          retryDecision: retryDecision.reason,
        },
      };
      let stagedGeminiCache = readStagedGeminiCache(job.result);
      const persistJobResultPatch = async (
        patch: Record<string, unknown>
      ) => {
        await supabase
          .from("analysis_jobs")
          .update({
            result: {
              ...(job.result ?? {}),
              corpusRetrievalCache,
              stagedGeminiCache,
              ...patch,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("id", job.id);
      };

      if (
        input.practiceTrack === "debate" &&
        input.isFullRound &&
        process.env.PRACTICE_FULL_ROUND_STAGED_JUDGE_ENABLED !== "false"
      ) {
        effectiveProvider = "google";
        effectiveModel =
          process.env.GEMINI_FULL_ROUND_JUDGE_MODEL ||
          process.env.GEMINI_FLASH_LITE_MODEL ||
          "gemini-3.1-flash-lite";
      }
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
          await persistJobResultPatch({ corpusRetrievalCache: entry });
        },
      });
      if (input.providerAudit) {
        const providerAudit = input.providerAudit as typeof input.providerAudit & {
          stagedGeminiCache?: StagedGeminiCache;
          onStagedGeminiCacheEntry?: (
            entry: StagedGeminiCacheEntry
          ) => void | Promise<void>;
        };
        providerAudit.stagedGeminiCache = stagedGeminiCache;
        providerAudit.onStagedGeminiCacheEntry = async (entry) => {
          stagedGeminiCache = {
            ...(stagedGeminiCache ?? {}),
            [entry.stage]: entry,
          };
          await persistJobResultPatch({ stagedGeminiCache });
        };
      }
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
      const aiQualityTelemetry = telemetry as AiQualityTelemetry | null;
      const modelName =
        aiQualityTelemetry?.model ??
        getPracticeFeedbackModelName(input.practiceTrack);
      effectiveProvider = aiQualityTelemetry?.provider ?? effectiveProvider;
      effectiveModel = modelName;
      const savedSession = await saveCompletedPracticeAttempt(supabase, {
        attempt,
        feedback,
        modelName,
      });
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
        modelProvider: effectiveProvider,
        legacySessionId: savedSession.sessionId,
        aiQualityRunId,
        resultMetadata: {
          ...(corpusRetrievalCache ? { corpusRetrievalCache } : {}),
          ...(stagedGeminiCache ? { stagedGeminiCache } : {}),
        },
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
        provider: effectiveProvider,
        requestedProvider: getPracticeFeedbackModelProvider(attempt.practice_track),
        model: effectiveModel,
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
      const retryAfterSeconds =
        retryDecision.deliveryCount >= deliveryLimit
          ? undefined
          : Math.min(300, 2 ** retryDecision.deliveryCount * 5);
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
    visibilityTimeoutSeconds: 120,
    retry: (_error, metadata) => {
      if (metadata.deliveryCount >= 3) return { acknowledge: true };
      return { afterSeconds: Math.min(300, 2 ** metadata.deliveryCount * 5) };
    },
  }
);
