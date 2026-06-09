import { NextRequest, NextResponse } from "next/server";
import {
  getJsonRecord,
  getString,
  readJsonObject,
  RequestValidationError,
} from "@/lib/api/request-validation";
import { requireRequestAuth } from "@/lib/api/request-auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { optInSmartPopupReminderEmails } from "@/lib/smart-popups/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireRequestAuth(request, { allowDevBypass: false });

  if (!auth.ok) {
    return auth.errorResponse;
  }

  const rateLimit = await consumeRateLimit(auth.supabase, {
    scope: "smart-popups-reminder-opt-in",
    limit: 12,
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
    const body = await readJsonObject(request, { maxBytes: 12 * 1024 });
    const campaignKey =
      getString(body, "campaignKey", {
        required: true,
        minLength: 1,
        maxLength: 120,
      }) ?? "";
    const admin = createAdminClient();
    const result = await optInSmartPopupReminderEmails({
      supabase: admin,
      userId: auth.user.id,
      campaignKey,
      locale: getString(body, "locale", { maxLength: 8 }),
      surface: getString(body, "surface", { maxLength: 32 }),
      route: getString(body, "route", { maxLength: 500 }),
      metadata: getJsonRecord(body, "metadata", {
        maxBytes: 6 * 1024,
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
            : "Unable to update reminder preferences.",
      },
      { status: error instanceof RequestValidationError ? error.status : 500 }
    );
  }
}
