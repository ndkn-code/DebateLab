import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MobilePracticeAttemptResponse,
  PracticeAnalysisInput,
} from "@thinkfy/shared/practice-analysis";

import { recordAnalyticsEvent } from "@/lib/analytics/server-events";
import {
  readJsonObject,
  RequestValidationError,
} from "@/lib/api/request-validation";
import {
  requireRequestAuth,
  shouldConsumeUserRateLimit,
  type RequestAuthSuccess,
} from "@/lib/api/request-auth";
import { consumeRateLimit } from "@/lib/rate-limit";
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

export const maxDuration = 20;

const CREDIT_COSTS = {
  speaking: 100,
  debate: 200,
} as const;

function getChargeType(practiceTrack: PracticeAnalysisInput["practiceTrack"]) {
  return practiceTrack === "speaking" ? "practice_speaking" : "practice_debate";
}

async function deleteUnchargedRecords(
  supabase: SupabaseClient,
  userId: string,
  attemptId: string,
) {
  await supabase
    .from("practice_attempts")
    .delete()
    .eq("id", attemptId)
    .eq("user_id", userId);
}

async function getExistingMobileAttempt(
  supabase: SupabaseClient,
  userId: string,
  attemptId: string,
): Promise<MobilePracticeAttemptResponse | null> {
  const { data: attempt } = await supabase
    .from("practice_attempts")
    .select("id, status")
    .eq("id", attemptId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!attempt) return null;

  const { data: job } = await supabase
    .from("analysis_jobs")
    .select("id, status, idempotency_key, queue_message_id")
    .eq("attempt_id", attemptId)
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

async function chargeCredits(
  auth: RequestAuthSuccess,
  input: PracticeAnalysisInput,
) {
  const cost = CREDIT_COSTS[input.practiceTrack];
  if (auth.authSource === "dev-bypass") {
    return { ok: true as const, chargedCredits: 0, orbBalance: null };
  }

  const attemptId = input.attemptId;
  if (!attemptId) {
    return {
      ok: false as const,
      status: 400,
      message: "attemptId is required.",
      code: "missing_attempt_id",
    };
  }

  const chargeType = getChargeType(input.practiceTrack);
  const existingCharge = await auth.supabase
    .from("orb_transactions")
    .select("balance_after")
    .eq("user_id", auth.user.id)
    .eq("reference_id", attemptId)
    .in("type", ["practice_speaking", "practice_debate"])
    .maybeSingle();

  if (existingCharge.data) {
    return {
      ok: true as const,
      chargedCredits: cost,
      orbBalance: existingCharge.data.balance_after as number,
    };
  }

  const { data: profile } = await auth.supabase
    .from("profiles")
    .select("orb_balance")
    .eq("id", auth.user.id)
    .single();
  const balance = profile?.orb_balance ?? 0;
  if (balance < cost) {
    return {
      ok: false as const,
      status: 402,
      message: `Insufficient Credits. ${cost} Credits required.`,
      code: "insufficient_credits",
      orbBalance: balance,
    };
  }

  const { data, error } = await auth.supabase.rpc("adjust_orb_balance", {
    p_user_id: auth.user.id,
    p_amount: -cost,
    p_type: chargeType,
    p_reference_id: attemptId,
  });

  if (error) {
    const retryCharge = await auth.supabase
      .from("orb_transactions")
      .select("balance_after")
      .eq("user_id", auth.user.id)
      .eq("reference_id", attemptId)
      .in("type", ["practice_speaking", "practice_debate"])
      .maybeSingle();

    if (retryCharge.data) {
      return {
        ok: true as const,
        chargedCredits: cost,
        orbBalance: retryCharge.data.balance_after as number,
      };
    }

    return {
      ok: false as const,
      status: 500,
      message: error.message,
      code: "credit_deduction_failed",
      orbBalance: balance,
    };
  }

  return {
    ok: true as const,
    chargedCredits: cost,
    orbBalance: typeof data === "number" ? data : null,
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

    const { attempt, job, idempotencyKey } =
      await createPracticeAnalysisRecords(writeClient, auth.user.id, input);

    const charge = await chargeCredits(auth, input);
    if (!charge.ok) {
      await deleteUnchargedRecords(writeClient, auth.user.id, input.attemptId);
      return NextResponse.json(
        {
          error: charge.message,
          code: charge.code,
          orbBalance: "orbBalance" in charge ? charge.orbBalance : null,
          requiredCredits: CREDIT_COSTS[input.practiceTrack],
        },
        { status: charge.status },
      );
    }

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
        charged_credits: charge.chargedCredits,
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
          chargedCredits: charge.chargedCredits,
          orbBalance: charge.orbBalance,
        } satisfies MobilePracticeAttemptResponse,
        { status: 202 },
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
