import { NextRequest, NextResponse } from "next/server";

import {
  MOBILE_COACH_MESSAGE_MAX_LENGTH,
  MobileCoachApiError,
  sendMobileCoachMessage,
} from "@/lib/api/mobile-coach";
import {
  RequestValidationError,
  getString,
  readJsonObject,
} from "@/lib/api/request-validation";
import { requireRequestAuth } from "@/lib/api/request-auth";
import { consumeRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function coachErrorResponse(error: unknown) {
  if (error instanceof MobileCoachApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status }
    );
  }

  if (error instanceof RequestValidationError) {
    return NextResponse.json(
      { error: error.message, code: "invalid_request" },
      { status: error.status }
    );
  }

  if (process.env.NODE_ENV === "development") {
    console.error("Mobile coach send failed:", error);
  }

  return NextResponse.json(
    { error: "Unable to send coach message.", code: "coach_send_failed" },
    { status: 500 }
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireRequestAuth(request, { allowDevBypass: false });
  if (!auth.ok) return auth.errorResponse;

  const rateLimit = await consumeRateLimit(auth.supabase, {
    scope: "mobile-coach-chat",
    limit: 20,
    windowSeconds: 60,
  });
  if (!rateLimit.success) {
    return NextResponse.json(
      {
        error: "Too many coach messages. Please wait a moment.",
        code: "rate_limited",
      },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  try {
    const body = await readJsonObject(request, { maxBytes: 16 * 1024 });
    const response = await sendMobileCoachMessage({
      context: getString(body, "context", { maxLength: 80 }),
      contextId: getString(body, "contextId", { maxLength: 160 }),
      conversationId: getString(body, "conversationId", { maxLength: 160 }),
      message:
        getString(body, "message", {
          maxLength: MOBILE_COACH_MESSAGE_MAX_LENGTH,
          minLength: 1,
          required: true,
        }) ?? "",
      practiceLanguageInput: getString(body, "practiceLanguage", {
        maxLength: 8,
      }),
      supabase: auth.supabase,
      userId: auth.user.id,
    });

    return NextResponse.json(response);
  } catch (error) {
    return coachErrorResponse(error);
  }
}
