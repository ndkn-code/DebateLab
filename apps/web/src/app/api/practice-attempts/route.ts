import { NextRequest, NextResponse } from "next/server";
import { recordAnalyticsEvent } from "@/lib/analytics/server-events";
import { readJsonObject, RequestValidationError } from "@/lib/api/request-validation";
import {
  requireRequestAuth,
  shouldConsumeUserRateLimit,
} from "@/lib/api/request-auth";
import { enqueuePracticeAnalysis } from "@/lib/queues/practice-analysis";
import {
  attachQueueMessageId,
  createPracticeAnalysisRecords,
  markPracticeAnalysisFailed,
} from "@/lib/practice-analysis/service";
import {
  getPracticeAnalysisWordCount,
  parsePracticeAnalysisInput,
} from "@/lib/practice-analysis/request";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { consumeRateLimit } from "@/lib/rate-limit";

export const maxDuration = 20;

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRequestAuth(req);

    if (!auth.ok) {
      return auth.errorResponse;
    }

    const { supabase, user: authUser } = auth;
    if (shouldConsumeUserRateLimit(auth)) {
      const rateLimit = await consumeRateLimit(supabase, {
        scope: "practice_analysis",
        limit: 5,
        windowSeconds: 60,
      });
      if (!rateLimit.success) {
        return NextResponse.json(
          { error: "Too many requests. Please wait a moment." },
          {
            status: 429,
            headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
          }
        );
      }
    }

    const input = parsePracticeAnalysisInput(
      await readJsonObject(req, { maxBytes: 128 * 1024 })
    );
    const wordCount = getPracticeAnalysisWordCount(input);
    if (wordCount < 20) {
      return NextResponse.json(
        {
          error: `Transcript too short (${wordCount} words). Minimum 20 words required.`,
        },
        { status: 400 }
      );
    }

    const writeClient = tryCreateAdminClient() ?? supabase;
    const { attempt, job, idempotencyKey } = await createPracticeAnalysisRecords(
      writeClient,
      authUser.id,
      input
    );

    await recordAnalyticsEvent(writeClient, authUser.id, {
      eventName: "ai_feedback_requested",
      featureArea: "ai_feedback",
      metadata: {
        topic: input.topic,
        side: input.side,
        speech_type: input.speechType,
        practice_track: input.practiceTrack,
        practice_language: input.practiceLanguage,
        word_count: wordCount,
        practice_attempt_id: attempt.id,
        analysis_job_id: job.id,
      },
    });

    try {
      const { messageId } = await enqueuePracticeAnalysis({
        jobId: job.id,
        attemptId: attempt.id,
        userId: authUser.id,
      });
      await attachQueueMessageId(writeClient, job.id, messageId).catch(
        (error) => {
          console.warn(
            "Failed to attach queue message id",
            error instanceof Error ? error.message : error
          );
        }
      );

      return NextResponse.json(
        {
          attemptId: attempt.id,
          jobId: job.id,
          status: "queued",
          idempotencyKey,
          queueMessageId: messageId,
        },
        { status: 202 }
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to enqueue analysis.";
      await markPracticeAnalysisFailed(writeClient, {
        jobId: job.id,
        attemptId: attempt.id,
        errorCode: "QUEUE_ENQUEUE_FAILED",
        errorMessage: message,
      }).catch(() => {});
      return NextResponse.json(
        {
          error:
            "We saved your transcript, but could not queue analysis yet. Please try again in a moment.",
          attemptId: attempt.id,
          jobId: job.id,
        },
        { status: 503 }
      );
    }
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error(
      "practice-attempt create failed",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
