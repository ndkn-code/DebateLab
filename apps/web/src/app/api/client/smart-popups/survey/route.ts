import { NextRequest, NextResponse } from "next/server";
import {
  getJsonRecord,
  getString,
  readJsonObject,
  RequestValidationError,
} from "@/lib/api/request-validation";
import { consumeRateLimit } from "@/lib/rate-limit";
import { submitSmartPopupSurveyResponse } from "@/lib/smart-popups/service";
import { requireRequestAuth } from "@/lib/api/request-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireRequestAuth(request, { allowDevBypass: false });

  if (!auth.ok) {
    return auth.errorResponse;
  }

  const { user } = auth;
  const rateLimit = await consumeRateLimit(auth.supabase, {
    scope: "smart-popups-survey-submit",
    limit: 20,
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

  try {
    const body = await readJsonObject(request, { maxBytes: 48 * 1024 });
    const campaignKey =
      getString(body, "campaignKey", {
        required: true,
        minLength: 1,
        maxLength: 120,
      }) ?? "";
    const surveyVersionId =
      getString(body, "surveyVersionId", {
        required: true,
        minLength: 10,
        maxLength: 80,
      }) ?? "";
    const admin = createAdminClient();
    const result = await submitSmartPopupSurveyResponse({
      supabase: admin,
      userId: user.id,
      campaignKey,
      surveyVersionId,
      answers: body.answers,
      locale: getString(body, "locale", { maxLength: 8 }),
      surface: getString(body, "surface", { maxLength: 32 }),
      route: getString(body, "route", { maxLength: 500 }),
      impressionEventId: getString(body, "impressionEventId", {
        maxLength: 80,
      }),
      context: getJsonRecord(body, "context", {
        maxBytes: 8 * 1024,
        defaultValue: {},
      }),
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to submit popup feedback.",
      },
      { status: error instanceof RequestValidationError ? error.status : 500 }
    );
  }
}
