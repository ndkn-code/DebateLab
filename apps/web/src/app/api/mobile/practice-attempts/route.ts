import { NextRequest, NextResponse } from "next/server";
import type {
  MobilePracticeAttemptResponse,
} from "@thinkfy/shared/practice-analysis";
import type { SupabaseClient } from "@supabase/supabase-js";

import { recordAnalyticsEvent } from "@/lib/analytics/server-events";
import {
  readJsonObject,
  RequestValidationError,
} from "@/lib/api/request-validation";
import {
  requireRequestAuth,
  shouldConsumeUserRateLimit,
} from "@/lib/api/request-auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { enqueuePracticeAnalysis } from "@/lib/queues/practice-analysis";
import {
  attachQueueMessageId,
  createPracticeAnalysisRecords,
} from "@/lib/practice-analysis/service";
import {
  getPracticeAnalysisWordCount,
  parsePracticeAnalysisInput,
} from "@/lib/practice-analysis/request";
import { tryCreateAdminClient } from "@/lib/supabase/admin";

export const maxDuration = 20;

const CREDIT_COSTS = {
  speaking: 100,
  debate: 200,
} as const;

async function getExistingMobileAttempt(
  supabase: SupabaseClient,
  userId: string,
  clientAttemptAlias: string,
): Promise<MobilePracticeAttemptResponse | null> {
  const { data: attempt } = await supabase
    .from("practice_attempts")
    .select("id, status")
    .eq("client_attempt_alias", clientAttemptAlias)
    .eq("user_id", userId)
    .maybeSingle();

  if (!attempt) return null;

  const { data: job } = await supabase
    .from("analysis_jobs")
    .select("id, status, idempotency_key, queue_message_id")
    .eq("attempt_id", attempt.id)
    .eq("user_id", userId)
    .maybeSingle();

  if (!job) return null;

  return {
    attemptId: attempt.id,
    jobId: job.id,
    status: job.status,
    attemptStatus: attempt.status,
    idempotencyKey: job.idempotency_key,
    queueMessageId: job.queue_message_id,
    chargedCredits: 0,
    orbBalance: null,
  };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRequestAuth(req);

    if (!auth.ok) {
      return auth.errorResponse;
    }

    if (shouldConsumeUserRateLimit(auth)) {
      const rateLimit = await consumeRateLimit(auth.supabase, {
        scope: "mobile_practice_analysis",
        limit: 5,
        windowSeconds: 60,
      });
      if (!rateLimit.success) {
        return NextResponse.json(
          { error: "Too many requests. Please wait a moment." },
          {
            status: 429,
            headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
          },
        );
      }
    }

    const input = parsePracticeAnalysisInput(
      await readJsonObject(req, { maxBytes: 128 * 1024 }),
    );
    if (!input.attemptId) {
      return NextResponse.json(
        { error: "attemptId is required.", code: "missing_attempt_id" },
        { status: 400 },
      );
    }

    const wordCount = getPracticeAnalysisWordCount(input);
    if (wordCount < 20) {
      return NextResponse.json(
        {
          error: `Transcript too short (${wordCount} words). Minimum 20 words required.`,
          code: "short_transcript",
        },
        { status: 400 },
      );
    }

    const writeClient = tryCreateAdminClient();
    if (!writeClient) {
      return NextResponse.json(
        {
          error:
            "Analysis worker configuration is missing. Feedback was not queued.",
          code: "analysis_worker_unavailable",
        },
        { status: 503 },
      );
    }

    const existing = await getExistingMobileAttempt(
      writeClient,
      auth.user.id,
      input.attemptId,
    );
    if (existing) {
      if (existing.status === "queued" && !existing.queueMessageId) {
        try {
          const { messageId } = await enqueuePracticeAnalysis({
            jobId: existing.jobId,
            attemptId: existing.attemptId,
            userId: auth.user.id,
          });
          await attachQueueMessageId(writeClient, existing.jobId, messageId);

          return NextResponse.json(
            { ...existing, queueMessageId: messageId },
            { status: 202 },
          );
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Failed to enqueue analysis.";
          return NextResponse.json(
            {
              error:
                "We saved your transcript, but could not queue analysis yet. Please try again in a moment.",
              code: "queue_enqueue_failed",
              attemptId: existing.attemptId,
              jobId: existing.jobId,
              details: message,
            },
            { status: 503 },
          );
        }
      }

      return NextResponse.json(existing, { status: 202 });
    }

    let created: Awaited<ReturnType<typeof createPracticeAnalysisRecords>>;
    try {
      created = await createPracticeAnalysisRecords(writeClient, auth.user.id, input, {
        chargeCredits: true,
      });
    } catch (error) {
      if (error instanceof Error && /Insufficient Credits/i.test(error.message)) {
        return NextResponse.json(
          {
            error: `Insufficient Credits. ${CREDIT_COSTS[input.practiceTrack]} Credits required.`,
            code: "insufficient_credits",
            requiredCredits: CREDIT_COSTS[input.practiceTrack],
          },
          { status: 402 },
        );
      }
      throw error;
    }
    const { attempt, job, idempotencyKey } = created;
    const chargedCredits = CREDIT_COSTS[input.practiceTrack];

    await recordAnalyticsEvent(writeClient, auth.user.id, {
      eventName: "ai_feedback_requested",
      featureArea: "ai_feedback",
      metadata: {
        surface: "mobile",
        topic: input.topic,
        side: input.side,
        speech_type: input.speechType,
        practice_track: input.practiceTrack,
        practice_language: input.practiceLanguage,
        word_count: wordCount,
        stt_provider: input.transcription?.provider,
        stt_warnings: input.transcription?.warnings,
        charged_credits: chargedCredits,
        practice_attempt_id: attempt.id,
        analysis_job_id: job.id,
      },
    });

    try {
      const { messageId } = await enqueuePracticeAnalysis({
        jobId: job.id,
        attemptId: attempt.id,
        userId: auth.user.id,
      });
      await attachQueueMessageId(writeClient, job.id, messageId).catch(
        (error) => {
          console.warn(
            "Failed to attach mobile queue message id",
            error instanceof Error ? error.message : error,
          );
        },
      );

      return NextResponse.json(
        {
          attemptId: attempt.id,
          jobId: job.id,
          status: "queued",
          attemptStatus: attempt.status,
          idempotencyKey,
          queueMessageId: messageId,
          chargedCredits,
          orbBalance: null,
        } satisfies MobilePracticeAttemptResponse,
        { status: 202 },
      );
    } catch {
      await writeClient.rpc("refund_practice_analysis", {
        p_attempt_id: attempt.id,
        p_user_id: auth.user.id,
      });
      return NextResponse.json(
        {
          error:
            "We saved your transcript, but could not queue analysis yet. Please try again in a moment.",
          code: "queue_enqueue_failed",
          attemptId: attempt.id,
          jobId: job.id,
        },
        { status: 503 },
      );
    }
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json(
        { error: error.message, code: "invalid_request" },
        { status: error.status },
      );
    }

    console.error(
      "mobile practice-attempt create failed",
      error instanceof Error ? error.message : error,
    );
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
