import { NextRequest, NextResponse } from "next/server";
import { analyzeDebate } from "@/lib/gemini";
import { createClient } from "@/lib/supabase/server";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { consumeRateLimit } from "@/lib/rate-limit";
import { recordAnalyticsEvent } from "@/lib/analytics/server-events";
import { getDevAuthBypassUserFromRequest } from "@/lib/dev-auth-bypass";
import {
  createPracticeAnalysisRecords,
  markPracticeAnalysisCompleted,
  markPracticeAnalysisFailed,
  markPracticeAnalysisProcessing,
} from "@/lib/practice-analysis/service";
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

// Give Gemini enough room for annotation-heavy feedback while staying inside
// the common Vercel serverless ceiling.
export const maxDuration = 60;

import type { DebateRound, PracticeLanguage, PracticeTrack } from "@/types";
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
      ? value.aiResponse.trim().slice(0, 12000)
      : undefined;
  const duration =
    typeof value.duration === "number" && Number.isFinite(value.duration)
      ? Math.max(0, Math.min(7200, Math.floor(value.duration)))
      : undefined;

  return { roundNumber, type, label, transcript, aiResponse, duration };
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
  };
}

export async function POST(req: NextRequest) {
  const requestId = req.headers.get("x-debug-id") || createAnalyzeRequestId();
  const startedAt = Date.now();
  logAnalyzeRequest(requestId, "request_received");

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const authUser = user
      ? { id: user.id, email: user.email ?? null }
      : getDevAuthBypassUserFromRequest(req);

    if (!authUser) {
      logAnalyzeRequest(requestId, "unauthorized");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (user) {
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

    if (!process.env.GEMINI_API_KEY) {
      console.error(JSON.stringify({
        scope: "api/analyze",
        requestId,
        event: "missing_gemini_api_key",
      }));
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 }
      );
    }

    const body = parseAnalyzeRequest(await readJsonObject(req, { maxBytes: 96 * 1024 }));
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

    const writeClient = tryCreateAdminClient() ?? supabase;
    let durableAnalysis:
      | { attempt: PracticeAttemptRecord; job: AnalysisJobRecord }
      | null = null;
    try {
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
      console.warn(
        "Failed to create durable sync analysis record",
        error instanceof Error ? error.message : error
      );
    }

    // Call Gemini with a server-side timeout that leaves a small response buffer.
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error("TIMEOUT")), 55000);
    });

    try {
      logAnalyzeRequest(requestId, "gemini_started", {
        model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
      });
      const feedback = await Promise.race([
        analyzeDebate({
          transcript,
          topic,
          side,
          speechType: speechType || "Opening Statement",
          timeLimit: timeLimit || 2,
          actualDuration: actualDuration || 0,
          practiceTrack: practiceTrack || "debate",
          practiceLanguage,
          isFullRound,
          rounds,
        }, authUser.id),
        timeoutPromise,
      ]);

      const modelUsed = process.env.GEMINI_MODEL || "gemini-2.5-flash";
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
        },
      });
      if (durableAnalysis) {
        await markPracticeAnalysisCompleted(writeClient, {
          attemptId: durableAnalysis.attempt.id,
          jobId: durableAnalysis.job.id,
          feedback,
          modelName: modelUsed,
          legacySessionId: null,
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
      });
    } catch (err) {
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
        event: "gemini_failed",
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
