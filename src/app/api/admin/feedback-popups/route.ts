import { NextRequest, NextResponse } from "next/server";
import {
  getEnum,
  getJsonRecord,
  getNumber,
  getString,
  readJsonObject,
  RequestValidationError,
} from "@/lib/api/request-validation";
import { isAdminUser } from "@/lib/auth/admin";
import { isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  getFeedbackPopupAdminData,
  saveFeedbackPopupCampaign,
  sendFeedbackPopupNow,
  setFeedbackPopupCampaignStatus,
} from "@/lib/smart-popups/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const devBypass = isDevAdminBypassEnabled();

  if (!user && devBypass) {
    return {
      supabase,
      actorId: "00000000-0000-4000-8000-000000000001",
      devBypass: true,
    };
  }

  if (!user) {
    throw new RequestValidationError("Unauthorized", 401);
  }

  if (!(await isAdminUser(supabase, user.id)) && !devBypass) {
    throw new RequestValidationError("Forbidden", 403);
  }

  return { supabase, actorId: user.id, devBypass: false };
}

async function rateLimitAdmin(
  supabase: Awaited<ReturnType<typeof createClient>>,
  options: { skip?: boolean } = {}
) {
  if (options.skip) return null;

  const rateLimit = await consumeRateLimit(supabase, {
    scope: "admin-feedback-popups",
    limit: 60,
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

  return null;
}

function jsonError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof RequestValidationError ? error.status : 400;
  return NextResponse.json({ error: message }, { status });
}

export async function GET() {
  try {
    const { supabase, devBypass } = await requireAdmin();
    const limited = await rateLimitAdmin(supabase, { skip: devBypass });
    if (limited) return limited;

    const data = await getFeedbackPopupAdminData(createAdminClient());
    return NextResponse.json(data);
  } catch (error) {
    return jsonError(error, "Unable to load feedback popups.");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, actorId, devBypass } = await requireAdmin();
    const limited = await rateLimitAdmin(supabase, { skip: devBypass });
    if (limited) return limited;

    const body = await readJsonObject(request, { maxBytes: 96 * 1024 });
    const action = getEnum(
      body,
      "action",
      ["save", "set_status", "send_now"] as const,
      { required: true }
    );
    const admin = createAdminClient();

    if (action === "save") {
      const result = await saveFeedbackPopupCampaign(admin, {
        actorId,
        campaignKey: getString(body, "campaignKey", { maxLength: 120 }),
        titleEn:
          getString(body, "titleEn", {
            required: true,
            minLength: 3,
            maxLength: 160,
          }) ?? "",
        bodyEn:
          getString(body, "bodyEn", {
            required: true,
            minLength: 3,
            maxLength: 400,
          }) ?? "",
        titleVi:
          getString(body, "titleVi", {
            required: true,
            minLength: 3,
            maxLength: 180,
          }) ?? "",
        bodyVi:
          getString(body, "bodyVi", {
            required: true,
            minLength: 3,
            maxLength: 420,
          }) ?? "",
        questions: body.questions,
        status: getEnum(body, "status", ["active", "paused", "archived"] as const, {
          defaultValue: "paused",
        }),
        deliveryMode: getEnum(
          body,
          "deliveryMode",
          ["targeted", "send_now", "scheduled"] as const,
          { defaultValue: "targeted" }
        ),
        priority: getNumber(body, "priority", {
          min: 1,
          max: 200,
          defaultValue: 25,
        }),
        responseGoal: getNumber(body, "responseGoal", {
          min: 1,
          max: 100000,
        }),
        rules: getJsonRecord(body, "rules", {
          maxBytes: 8 * 1024,
          defaultValue: {},
        }),
      });
      return NextResponse.json({
        ok: true,
        result,
        data: await getFeedbackPopupAdminData(admin),
      });
    }

    const campaignKey =
      getString(body, "campaignKey", {
        required: true,
        minLength: 1,
        maxLength: 120,
      }) ?? "";

    if (action === "send_now") {
      await sendFeedbackPopupNow(admin, { actorId, campaignKey });
    } else {
      const status =
        getEnum(body, "status", ["active", "paused", "archived"] as const, {
          required: true,
        }) ?? "paused";
      await setFeedbackPopupCampaignStatus(admin, {
        actorId,
        campaignKey,
        status,
      });
    }

    return NextResponse.json({
      ok: true,
      data: await getFeedbackPopupAdminData(admin),
    });
  } catch (error) {
    return jsonError(error, "Unable to update feedback popups.");
  }
}
