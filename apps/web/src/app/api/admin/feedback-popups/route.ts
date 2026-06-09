import { NextResponse } from "next/server";
import {
  RequestValidationError,
} from "@/lib/api/request-validation";
import { isAdminUser } from "@/lib/auth/admin";
import { isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  createEmptyFeedbackPopupAdminData,
  getFeedbackPopupAdminData,
} from "@/lib/smart-popups/admin";
import { getAdminClientConfigStatus, tryCreateAdminClient } from "@/lib/supabase/admin";
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

function getServiceRoleConfigStatus() {
  const config = getAdminClientConfigStatus();
  return config.hasUrl && config.hasServiceRoleKey;
}

export async function GET() {
  try {
    const { supabase, devBypass } = await requireAdmin();
    const limited = await rateLimitAdmin(supabase, { skip: devBypass });
    if (limited) return limited;

    const admin = tryCreateAdminClient();
    const serviceRoleConfigured = getServiceRoleConfigStatus();
    const data = await getFeedbackPopupAdminData(admin ?? supabase, {
      dataSource: admin ? "service_role" : "session",
      serviceRoleConfigured,
    });
    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return jsonError(error, "Unable to load feedback popups.");
    }
    const message =
      error instanceof Error ? error.message : "Unable to load feedback popups.";
    console.error("[feedback-popups-admin-api] Unable to load data", { message });
    return NextResponse.json(
      createEmptyFeedbackPopupAdminData({
        status: "error",
        message,
        dataSource: tryCreateAdminClient() ? "service_role" : "session",
        serviceRoleConfigured: getServiceRoleConfigStatus(),
      })
    );
  }
}

export async function POST() {
  return NextResponse.json(
    {
      error:
        "Feedback popup campaigns are developer-defined in code and migrations. Admin is read-only in this release.",
    },
    { status: 405 }
  );
}
