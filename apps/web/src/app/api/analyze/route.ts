import { NextRequest, NextResponse } from "next/server";
import { analyzeDebate } from "@/lib/gemini";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { recordAiQualityRun } from "@/lib/ai/quality";
import type { AiQualityTelemetry } from "@/lib/ai/quality-model";
import { createScoreCalibrationMetadata } from "@/lib/ai/score-calibration";
import {
  createDebateCorpusRetrievalMetadata,
  linkDebateCorpusRetrievalLogToAiRun,
  retrieveDebateCorpusContext,
} from "@/lib/corpus/retrieval";
import { consumeRateLimit } from "@/lib/rate-limit";
import { recordAnalyticsEvent } from "@/lib/analytics/server-events";
import {
  requireRequestAuth,
  shouldConsumeUserRateLimit,
} from "@/lib/api/request-auth";
import {
  createPracticeAnalysisRecords,
  markPracticeAnalysisCompleted,
  markPracticeAnalysisFailed,
  markPracticeAnalysisProcessing,
} from "@/lib/practice-analysis/service";
import { parseTranscriptionArtifact } from "@/lib/practice-analysis/request";
import { createTranscriptionQualityMetadata } from "@/lib/stt/prompt";
import { selectTranscriptForJudging } from "@/lib/stt/repair";
import { recordSttRepairShadowRun } from "@/lib/stt/shadow-runs";
import {
  getPracticeFeedbackModelProvider,
  getPracticeFeedbackModelName,
} from "@/lib/practice-analysis/constants";
import {
  getBoolean,
  getEnum,
  getNumber,
  getString,
  isPlainRecord,
  readJsonObject,
  RequestValidationError,
  type JsonRecord,
} from "@/lib/api/request-validation";
import { normalizeRebuttalText } from "@/lib/rebuttal/structured-response";

// Give model providers enough room for annotation-heavy feedback while staying inside
// the common Vercel serverless ceiling.
export const maxDuration = 60;

import type {
  DebateMemory,
  DebateRound,
  MotionBrief,
  PracticeLanguage,
  PracticeTrack,
} from "@/types";
import type { PracticeTranscriptionArtifact } from "@thinkfy/shared/practice";
import type { AnalysisJobRecord, PracticeAttemptRecord } from "@/lib/practice-analysis/types";

interface AnalyzeRequest {
  transcript: string;
  topic: string;
  side: "proposition" | "opposition";
  speechType: string;
  timeLimit: number;
  actualDuration: number;
  practiceTrack?: PracticeTrack;
  practiceLanguage: PracticeLanguage;
  isFullRound?: boolean;
  rounds?: DebateRound[];
  motionBrief?: MotionBrief;
  debateMemory?: DebateMemory;
  transcription?: PracticeTranscriptionArtifact;
  prepNotes?: string;
}

function createAnalyzeRequestId() {
  return `analyze-${crypto.randomUUID()}`;
}

function logAnalyzeRequest(
  requestId: string,
  event: string,
  metadata: Record<string, unknown> = {}
) {
  console.info(JSON.stringify({ scope: "api/analyze", requestId, event, ...metadata }));
}

function parseRound(value: unknown, index: number): DebateRound {
  if (!isPlainRecord(value)) {
    throw new RequestValidationError(`rounds[${index}] is invalid.`);
  }

  const roundNumber =
    typeof value.roundNumber === "number" && Number.isFinite(value.roundNumber)
      ? Math.max(1, Math.floor(value.roundNumber))
      : index + 1;
  const type =
    value.type === "ai-rebuttal" || value.type === "user-speech"
      ? value.type
      : "user-speech";
  const label =
    typeof value.label === "string"
      ? value.label.trim().slice(0, 80)
      : `Round ${roundNumber}`;
  const transcript =
    typeof value.transcript === "string"
      ? value.transcript.trim().slice(0, 12000)
      : undefined;
  const aiResponse =
    typeof value.aiResponse === "string"
      ? normalizeRebuttalText(value.aiResponse).slice(0, 12000)
      : undefined;
  const duration =
    typeof value.duration === "number" && Number.isFinite(value.duration)
      ? Math.max(0, Math.min(7200, Math.floor(value.duration)))
      : undefined;

  return { roundNumber, type, label, transcript, aiResponse, duration };
}

function readStringArray(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => (typeof item === "string" ? item.trim().slice(0, maxLength) : ""))
    .filter(Boolean)
    .slice(0, maxItems);
}

function parseMotionBrief(value: unknown): MotionBrief | undefined {
  if (!isPlainRecord(value)) return undefined;
  const keyTerms = readStringArray(value.keyTerms, 8, 240);
  const scope = typeof value.scope === "string" ? value.scope.trim().slice(0, 1200) : "";
  const propositionBurden =
    typeof value.propositionBurden === "string"
      ? value.propositionBurden.trim().slice(0, 1200)
      : "";
  const oppositionBurden =
    typeof value.oppositionBurden === "string"
      ? value.oppositionBurden.trim().slice(0, 1200)
      : "";
  const modelClarification =
    typeof value.modelClarification === "string"
      ? value.modelClarification.trim().slice(0, 1200)
      : "";

  if (!keyTerms.length || !scope || !propositionBurden || !oppositionBurden || !modelClarification) {
    return undefined;
  }

  return {
    keyTerms,
    scope,
    propositionBurden,
    oppositionBurden,
    modelClarification,
  };
}

function parseDebateMemory(value: unknown): DebateMemory | undefined {
  if (!isPlainRecord(value)) return undefined;
  const aiSide =
    value.aiSide === "proposition" || value.aiSide === "opposition"
      ? value.aiSide
      : null;
  const studentSide =
    value.studentSide === "proposition" || value.studentSide === "opposition"
      ? value.studentSide
      : null;
  const policyModel =
    typeof value.policyModel === "string"
      ? value.policyModel.trim().slice(0, 1200)
      : "";

  if (!aiSide || !studentSide || !policyModel) return undefined;

  return {
    aiSide,
    studentSide,
    policyModel,
    priorAiClaims: readStringArray(value.priorAiClaims, 12, 500),
    concessions: readStringArray(value.concessions, 8, 500),
    activeClashes: readStringArray(value.activeClashes, 12, 500),
    droppedClaims: readStringArray(value.droppedClaims, 8, 500),
  };
}

function parseAnalyzeRequest(body: JsonRecord): AnalyzeRequest {
  const transcript = getString(body, "transcript", {
    required: true,
    minLength: 1,
    maxLength: 45000,
  })!;
  const topic = getString(body, "topic", {
    required: true,
    minLength: 2,
    maxLength: 300,
  })!;
  const side = getEnum(body, "side", ["proposition", "opposition"] as const, {
    required: true,
  })!;
  const speechType = getString(body, "speechType", {
    maxLength: 80,
    defaultValue: "Opening Statement",
  })!;
  const timeLimit = getNumber(body, "timeLimit", {
    min: 0,
    max: 7200,
    defaultValue: 2,
  })!;
  const actualDuration = getNumber(body, "actualDuration", {
    min: 0,
    max: 7200,
    defaultValue: 0,
  })!;
  const prepNotes = getString(body, "prepNotes", {
    maxLength: 12000,
  });
  const practiceTrack = getEnum(
    body,
    "practiceTrack",
    ["speaking", "debate"] as const,
    { defaultValue: "debate" }
  ) as PracticeTrack;
  const practiceLanguage = getEnum(
    body,
    "practiceLanguage",
    ["en", "vi"] as const,
    { defaultValue: "en" }
  ) as PracticeLanguage;
  const roundsValue = body.rounds;
  const rounds =
    roundsValue == null
      ? undefined
      : Array.isArray(roundsValue) && roundsValue.length <= 12
        ? roundsValue.map(parseRound)
        : (() => {
            throw new RequestValidationError("rounds is invalid.");
          })();

  return {
    transcript,
    topic,
    side,
    speechType,
    timeLimit,
    actualDuration,
    practiceTrack,
    practiceLanguage,
    isFullRound: getBoolean(body, "isFullRound", false),
    rounds,
    motionBrief: parseMotionBrief(body.motionBrief),
    debateMemory: parseDebateMemory(body.debateMemory),
    transcription: parseTranscriptionArtifact(body.transcription),
    prepNotes,
  };
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-debug-id") || createAnalyzeRequestId();
  const startedAt = Date.now();
  logAnalyzeRequest(requestId, "request_received");

  try {
    const auth = await requireRequestAuth(req);

    if (!auth.ok) {
      logAnalyzeRequest(requestId, "unauthorized");
      return auth.errorResponse;
    }

    const { supabase, user: authUser } = auth;
    const shouldPersistAnalysis = auth.authSource !== "dev-bypass";
    if (shouldConsumeUserRateLimit(auth)) {
      const rateLimit = await consumeRateLimit(supabase, {
        scope: "analyze",
        limit: 5,
        windowSeconds: 60,
      });
      if (!rateLimit.success) {
        logAnalyzeRequest(requestId, "rate_limited", {
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        });
        return NextResponse.json(
          { error: "Too many requests. Please wait a moment." },
          {
            status: 429,
            headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
          }
        );
      }
    }

    const body = parseAnalyzeRequest(await readJsonObject(req, { maxBytes: 96 * 1024 }));
    const configuredProvider = getPracticeFeedbackModelProvider(
      body.practiceTrack || "debate"
    );
    const hasConfiguredProvider =
      configuredProvider === "deepseek"
        ? Boolean(process.env.DEEPSEEK_API_KEY)
        : Boolean(process.env.GEMINI_API_KEY);

    if (!hasConfiguredProvider) {
      console.error(JSON.stringify({
        scope: "api/analyze",
        requestId,
        event: "missing_ai_provider_key",
        provider: configuredProvider,
      }));
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 }
      );
    }

    const {
      transcript,
      topic,
      side,
      speechType,
      timeLimit,
      actualDuration,
      practiceTrack,
      practiceLanguage,
      isFullRound,
      rounds,
      motionBrief,
      debateMemory,
      transcription,
      prepNotes,
    } =
      body;

    // Validate required fields
    if (!transcript || !topic || !side) {
      logAnalyzeRequest(requestId, "missing_required_fields", {
        hasTranscript: Boolean(transcript),
        hasTopic: Boolean(topic),
        hasSide: Boolean(side),
      });
      return NextResponse.json(
        { error: "Missing required fields: transcript, topic, side" },
        { status: 400 }
      );
    }

    // Validate transcript length
    const wordCount = transcript
      .split(/\s+/)
      .filter((w) => w.length > 0).length;
    logAnalyzeRequest(requestId, "request_validated", {
      wordCount,
      practiceTrack,
      practiceLanguage,
      mode: speechType,
      isFullRound,
      roundCount: rounds?.length ?? 0,
    });
    if (wordCount < 20) {
      logAnalyzeRequest(requestId, "transcript_too_short", { wordCount });
      return NextResponse.json(
        {
          error: `Transcript too short (${wordCount} words). Minimum 20 words required.`,
        },
        { status: 400 }
      );
    }

    if (shouldPersistAnalysis) {
      await recordAnalyticsEvent(supabase, authUser.id, {
        eventName: "ai_feedback_requested",
        featureArea: "ai_feedback",
        metadata: {
          topic,
          side,
          speech_type: speechType || "Opening Statement",
          practice_track: practiceTrack || "debate",
          practice_language: practiceLanguage,
          word_count: wordCount,
          debug_id: requestId,
        },
      });
    }

    const judgingTranscript = selectTranscriptForJudging({
      transcript,
      transcription,
      practiceLanguage,
      practiceTrack: practiceTrack || "debate",
    });
    const shadowVariant =
      transcription?.judgeTranscript && judgingTranscript === transcript
        ? "repair_available_not_used"
        : judgingTranscript !== transcript
          ? "repair_used_for_judge"
          : "baseline";

    const adminClient = tryCreateAdminClient();
    const writeClient = adminClient ?? supabase;
    let durableAnalysis:
      | { attempt: PracticeAttemptRecord; job: AnalysisJobRecord }
      | null = null;
    try {
      if (!shouldPersistAnalysis) {
        throw new Error("Skipping durable analysis records for dev auth bypass");
      }
      durableAnalysis = await createPracticeAnalysisRecords(writeClient, authUser.id, {
        transcript,
        topic,
        side,
        speechType: speechType || "Opening Statement",
        timeLimit: timeLimit || 2,
        actualDuration: actualDuration || 0,
        practiceTrack: practiceTrack || "debate",
        practiceLanguage,
        isFullRound: Boolean(isFullRound),
        rounds,
        motionBrief,
        debateMemory,
        transcription,
        prepNotes,
        mode:
          practiceTrack === "debate" && (isFullRound || speechType.includes("Full Round"))
            ? "full"
            : "quick",
        prepTime: 0,
        speechTime: Math.round((timeLimit || 2) * 60),
        topicCategory: "Practice",
        topicDifficulty: "intermediate",
      });
      await markPracticeAnalysisProcessing(writeClient, {
        jobId: durableAnalysis.job.id,
        attemptId: durableAnalysis.attempt.id,
        deliveryCount: 1,
      });
    } catch (error) {
      durableAnalysis = null;
      if (shouldPersistAnalysis) {
        console.warn(
          "Failed to create durable sync analysis record",
          error instanceof Error ? error.message : error
        );
      }
    }

    const corpusRetrieval = await retrieveDebateCorpusContext({
      purpose: "judging",
      practiceLanguage,
      practiceTrack: practiceTrack || "debate",
      topic,
      side,
      transcript: judgingTranscript,
      roundsText: rounds?.map(
        (round) => round.transcript || round.aiResponse || ""
      ),
      userId: shouldPersistAnalysis ? authUser.id : null,
      sourceRoute: "/api/analyze",
      supabase: adminClient ?? undefined,
    });

    // Call Gemini with a server-side timeout that leaves a small response buffer.
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("TIMEOUT")), 55000);
    });

    try {
      logAnalyzeRequest(requestId, "analysis_started", {
        model: getPracticeFeedbackModelName(practiceTrack || "debate"),
      });
      let telemetry: AiQualityTelemetry | null = null;
      const feedback = await Promise.race([
        analyzeDebate({
          transcript: judgingTranscript,
          topic,
          side,
          speechType: speechType || "Opening Statement",
          timeLimit: timeLimit || 2,
          actualDuration: actualDuration || 0,
          practiceTrack: practiceTrack || "debate",
          practiceLanguage,
          isFullRound,
          rounds,
          motionBrief,
          debateMemory,
          transcription,
          prepNotes,
          corpusContext: corpusRetrieval.contextBlock,
          providerAudit: {
            sourceRoute: "/api/analyze",
            practiceAttemptId: durableAnalysis?.attempt.id,
            analysisJobId: durableAnalysis?.job.id,
            metadata: {
              debugId: requestId,
              sttRepair: transcription?.repair ?? null,
              shadowVariant,
            },
          },
        }, authUser.id, (nextTelemetry) => {
          telemetry = nextTelemetry;
        }),
        timeoutPromise,
      ]);

      const modelUsed = getPracticeFeedbackModelName(practiceTrack || "debate");
      const aiQualityTelemetry = telemetry as AiQualityTelemetry | null;
      const transcriptionMetadata = transcription
        ? createTranscriptionQualityMetadata(transcription)
        : null;
      const scoreCalibration = createScoreCalibrationMetadata(
        feedback,
        aiQualityTelemetry
      );
      const aiQualityRunId =
        shouldPersistAnalysis && aiQualityTelemetry
          ? await recordAiQualityRun(writeClient, {
              ...aiQualityTelemetry,
              userId: authUser.id,
              outputType: "practice_judging",
              sourceRoute: "/api/analyze",
              promptBundleKey: durableAnalysis?.attempt.prompt_bundle_key ?? "practice_feedback",
              promptBundleVersion:
                durableAnalysis?.attempt.prompt_bundle_version ?? null,
              promptHash: durableAnalysis?.attempt.prompt_hash ?? null,
              rubricKey: durableAnalysis?.attempt.rubric_key ?? null,
              rubricVersion: durableAnalysis?.attempt.rubric_version ?? null,
              practiceTrack: practiceTrack || "debate",
              practiceLanguage,
              difficulty: durableAnalysis?.attempt.ai_difficulty ?? undefined,
              debateFormat: isFullRound ? "full" : "quick",
              side,
              topicTitle: topic,
              winner: feedback.debateVerdict?.winner ?? null,
              score: feedback.totalScore,
              confidence: feedback.debateVerdict?.confidence ?? null,
              outputText: JSON.stringify(feedback),
              inputPreview: transcript,
              practiceAttemptId: durableAnalysis?.attempt.id ?? null,
              analysisJobId: durableAnalysis?.job.id ?? null,
              debateSessionId: null,
              metadata: {
                ...(aiQualityTelemetry.metadata ?? {}),
                debugId: requestId,
                speechType,
                isFullRound,
                roundCount: rounds?.length ?? 0,
                ...createDebateCorpusRetrievalMetadata(corpusRetrieval),
                annotationAcceptedCount:
                  feedback.annotationMetadata?.acceptedCount ?? null,
                annotationRejectedCount:
                  feedback.annotationMetadata?.rejectedCount ?? null,
                annotationRepairUsed:
                  feedback.annotationMetadata?.repairUsed ?? false,
                annotationFallbackUsed:
                  feedback.annotationMetadata?.fallbackUsed ?? false,
                transcription: transcriptionMetadata ?? undefined,
                sttRepair: transcription?.repair ?? null,
                shadowVariant,
                scoreBefore: scoreCalibration.scoreBefore,
                scoreAfter: scoreCalibration.scoreAfter,
                scoreDelta: scoreCalibration.scoreDelta,
                softCapReasons: scoreCalibration.softCapReasons,
                sttSelectedProvider:
                  transcriptionMetadata?.sttSelectedProvider ?? null,
                sttShadowProvider:
                  transcriptionMetadata?.sttShadowProvider ?? null,
                sttShadowRejectedReason:
                  transcriptionMetadata?.sttShadowRejectedReason ?? null,
              },
            })
          : null;
      await linkDebateCorpusRetrievalLogToAiRun(
        corpusRetrieval.logId,
        aiQualityRunId,
        adminClient ?? undefined
      );
      if (shouldPersistAnalysis) {
        await recordSttRepairShadowRun(writeClient, {
          userId: authUser.id,
          sourceRoute: "/api/analyze",
          transcription,
          transcript,
          feedback,
          practiceAttemptId: durableAnalysis?.attempt.id ?? null,
          analysisJobId: durableAnalysis?.job.id ?? null,
          debateSessionId: null,
          practiceTrack: practiceTrack || "debate",
          practiceLanguage,
          topicTitle: topic,
          side,
          audioStoragePath:
            durableAnalysis?.attempt.audio_storage_path ??
            transcription?.audioStoragePath ??
            null,
          scoreBefore: scoreCalibration.scoreBefore,
          scoreAfter: scoreCalibration.scoreAfter,
          softCapReasons: scoreCalibration.softCapReasons,
          metrics: {
            aiQualityRunId,
            shadowVariant,
            repairUsedForJudge: judgingTranscript !== transcript,
            corpusRetrievalLogId: corpusRetrieval.logId,
          },
        });
      }
      if (shouldPersistAnalysis) {
        await recordAnalyticsEvent(supabase, authUser.id, {
          eventName: "ai_feedback_completed",
          featureArea: "ai_feedback",
          durationMs: actualDuration ? actualDuration * 1000 : null,
          metadata: {
            topic,
            side,
            speech_type: speechType || "Opening Statement",
            practice_track: practiceTrack || "debate",
            practice_language: practiceLanguage,
            model: modelUsed,
            debug_id: requestId,
            corpus_rag_enabled: corpusRetrieval.enabled,
            retrieved_corpus_count: corpusRetrieval.items.length,
            candidate_corpus_count: corpusRetrieval.candidateItems.length,
            corpus_rag_skipped_reason: corpusRetrieval.skippedReason,
            corpus_rag_top_similarity: corpusRetrieval.topSimilarity,
            corpus_rag_relevance_gate_passed: corpusRetrieval.relevanceGatePassed,
          },
        });
      }
      if (durableAnalysis) {
        await markPracticeAnalysisCompleted(writeClient, {
          attemptId: durableAnalysis.attempt.id,
          jobId: durableAnalysis.job.id,
          feedback,
          modelName: modelUsed,
          legacySessionId: null,
          aiQualityRunId,
        }).catch((error) => {
          console.warn(
            "Failed to complete durable sync analysis record",
            error instanceof Error ? error.message : error
          );
        });
      }
      logAnalyzeRequest(requestId, "completed", {
        durationMs: Date.now() - startedAt,
        model: modelUsed,
      });
      return NextResponse.json({
        ...feedback,
        _model: modelUsed,
        _attemptId: durableAnalysis?.attempt.id,
        _analysisJobId: durableAnalysis?.job.id,
        _aiRunId: aiQualityRunId,
      });
    } catch (err) {
      if (shouldPersistAnalysis) {
        await recordAiQualityRun(writeClient, {
          userId: authUser.id,
          outputType: "practice_judging",
          status: "error",
          sourceRoute: "/api/analyze",
          provider: configuredProvider,
          requestedProvider: configuredProvider,
          model: getPracticeFeedbackModelName(practiceTrack || "debate"),
          promptBundleKey: durableAnalysis?.attempt.prompt_bundle_key ?? "practice_feedback",
          promptBundleVersion:
            durableAnalysis?.attempt.prompt_bundle_version ?? null,
          promptHash: durableAnalysis?.attempt.prompt_hash ?? null,
          rubricKey: durableAnalysis?.attempt.rubric_key ?? null,
          rubricVersion: durableAnalysis?.attempt.rubric_version ?? null,
          practiceTrack: practiceTrack || "debate",
          practiceLanguage,
          difficulty: durableAnalysis?.attempt.ai_difficulty ?? undefined,
          debateFormat: isFullRound ? "full" : "quick",
          side,
          topicTitle: topic,
          latencyMs: Date.now() - startedAt,
          errorCode:
            err instanceof Error && err.message === "TIMEOUT"
              ? "TIMEOUT"
              : "ANALYSIS_FAILED",
          errorMessage: err instanceof Error ? err.message : String(err),
          inputPreview: transcript,
          practiceAttemptId: durableAnalysis?.attempt.id ?? null,
          analysisJobId: durableAnalysis?.job.id ?? null,
          metadata: {
            debugId: requestId,
            speechType,
            isFullRound,
            roundCount: rounds?.length ?? 0,
            ...createDebateCorpusRetrievalMetadata(corpusRetrieval),
            transcription: transcription
              ? createTranscriptionQualityMetadata(transcription)
              : undefined,
          },
        }).catch(() => null);
      }
      if (durableAnalysis) {
        await markPracticeAnalysisFailed(writeClient, {
          jobId: durableAnalysis.job.id,
          attemptId: durableAnalysis.attempt.id,
          errorCode: "SYNC_ANALYSIS_FAILED",
          errorMessage: err instanceof Error ? err.message : String(err),
        }).catch(() => {});
      }
      console.error(JSON.stringify({
        scope: "api/analyze",
        requestId,
        event: "analysis_failed",
        durationMs: Date.now() - startedAt,
        message: err instanceof Error ? err.message : String(err),
      }));

      if (err instanceof Error) {
        if (err.message === "TIMEOUT") {
          logAnalyzeRequest(requestId, "timeout", {
            durationMs: Date.now() - startedAt,
          });
          return NextResponse.json(
            {
              error:
                "Analysis is taking longer than expected. Your transcript is safe, so please try again in a moment.",
            },
            { status: 504 }
          );
        }
        if (err.message.includes("429") || err.message.includes("rate") || err.message.includes("quota")) {
          return NextResponse.json(
            { error: "Rate limit reached. Please wait a moment and try again." },
            { status: 429 }
          );
        }
        if (err.message.includes("Invalid response") || err.message.includes("JSON")) {
          logAnalyzeRequest(requestId, "parse_failed", {
            message: err.message,
          });
          return NextResponse.json(
            { error: "Failed to parse AI response. Please try again." },
            { status: 502 }
          );
        }
        if (err.message.includes("API_KEY") || err.message.includes("401") || err.message.includes("403")) {
          return NextResponse.json(
            { error: "Something went wrong. Please try again." },
            { status: 401 }
          );
        }
        return NextResponse.json(
          { error: "Something went wrong. Please try again." },
          { status: 500 }
        );
      }

      return NextResponse.json(
        { error: "An unexpected error occurred during analysis." },
        { status: 500 }
      );
    }
  } catch (err) {
    if (err instanceof RequestValidationError) {
      logAnalyzeRequest(requestId, "request_validation_failed", {
        durationMs: Date.now() - startedAt,
        message: err.message,
      });
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error(JSON.stringify({
      scope: "api/analyze",
      requestId,
      event: "unexpected_error",
      durationMs: Date.now() - startedAt,
      message: err instanceof Error ? err.message : String(err),
    }));
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
