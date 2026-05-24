import { NextRequest, NextResponse } from "next/server";
import {
  AI_QUALITY_FAIRNESS_VALUES,
  AI_QUALITY_USEFULNESS_VALUES,
  normalizeAiQualityReasonTags,
  type AiQualityFairness,
  type AiQualityUsefulness,
} from "@/lib/ai/quality-model";
import {
  recordAiQualityRating,
  deriveReviewStatusFromRating,
} from "@/lib/ai/quality";
import {
  getEnum,
  getString,
  isUuid,
  readJsonObject,
  RequestValidationError,
} from "@/lib/api/request-validation";
import {
  requireRequestAuth,
  shouldConsumeUserRateLimit,
} from "@/lib/api/request-auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { tryCreateAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRequestAuth(req);
    if (!auth.ok) return auth.errorResponse;

    const { supabase, user } = auth;
    if (shouldConsumeUserRateLimit(auth)) {
      const rateLimit = await consumeRateLimit(supabase, {
        scope: "ai_quality_rating",
        limit: 40,
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

    const body = await readJsonObject(req, { maxBytes: 16 * 1024 });
    const runId = getString(body, "runId", { required: true, maxLength: 80 })!;
    if (!isUuid(runId)) {
      throw new RequestValidationError("runId is invalid.");
    }

    const usefulness = getEnum(body, "usefulness", AI_QUALITY_USEFULNESS_VALUES) as
      | AiQualityUsefulness
      | undefined;
    const fairness = getEnum(body, "fairness", AI_QUALITY_FAIRNESS_VALUES) as
      | AiQualityFairness
      | undefined;
    const reasonTags = normalizeAiQualityReasonTags(body.reasonTags);
    const comment = getString(body, "comment", { maxLength: 1200 });
    const locale = getEnum(body, "locale", ["en", "vi"] as const);
    const route = getString(body, "route", { maxLength: 500 });

    if (!usefulness && !fairness && reasonTags.length === 0 && !comment) {
      throw new RequestValidationError("rating is empty.");
    }

    const ratingInput = {
      runId,
      userId: user.id,
      usefulness: usefulness ?? null,
      fairness: fairness ?? null,
      reasonTags,
      comment: comment ?? null,
      locale: locale ?? null,
      route: route ?? null,
    };
    const rating = await recordAiQualityRating(supabase, ratingInput);
    const reviewStatus = deriveReviewStatusFromRating(ratingInput);

    const writeClient = tryCreateAdminClient() ?? supabase;
    await writeClient
      .from("ai_quality_runs")
      .update({
        review_status: reviewStatus,
        updated_at: new Date().toISOString(),
      })
      .eq("id", runId)
      .eq("user_id", user.id)
      .eq("review_status", "unreviewed");

    return NextResponse.json({ ok: true, rating });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Unable to save AI feedback rating." },
      { status: 500 }
    );
  }
}
