import { NextRequest, NextResponse } from "next/server";
import {
  getEnum,
  getJsonRecord,
  getString,
  readJsonObject,
  RequestValidationError,
} from "@/lib/api/request-validation";
import { consumeRateLimit } from "@/lib/rate-limit";
import { recordSmartPopupEvent } from "@/lib/smart-popups/service";
import {
  SMART_POPUP_EVENT_TYPES,
  type SmartPopupEventType,
} from "@/lib/smart-popups/types";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await consumeRateLimit(supabase, {
    scope: "smart-popups-events",
    limit: 80,
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
    const campaignKey = getString(body, "campaignKey", {
      required: true,
      minLength: 1,
      maxLength: 120,
    }) ?? "";
    const eventType = getEnum(body, "eventType", SMART_POPUP_EVENT_TYPES, {
      required: true,
    }) as SmartPopupEventType;
    const admin = createAdminClient();

    await recordSmartPopupEvent({
      supabase: admin,
      userId: user.id,
      campaignKey,
      eventType,
      surface: getString(body, "surface", { maxLength: 32 }),
      route: getString(body, "route", { maxLength: 500 }),
      metadata: getJsonRecord(body, "metadata", {
        maxBytes: 6 * 1024,
        defaultValue: {},
      }),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to record popup event.",
      },
      { status: error instanceof RequestValidationError ? error.status : 500 }
    );
  }
}
