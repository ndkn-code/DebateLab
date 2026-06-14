import { NextRequest, NextResponse } from "next/server";
import { getString, readJsonObject } from "@/lib/api/request-validation";
import { consumeRateLimit } from "@/lib/rate-limit";
import { getNextSmartPopup } from "@/lib/smart-popups/service";
import {
  requireRequestAuth,
  type RequestAuthSuccess,
} from "@/lib/api/request-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SmartPopupRouteContext = {
  method: "GET" | "POST";
  userId?: string;
  locale?: string | null;
  surface?: string | null;
  route?: string | null;
  commit: boolean;
};

function logSmartPopupFailure(context: SmartPopupRouteContext, error: unknown) {
  console.error("[smart-popups/next] failed", {
    ...context,
    error:
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : error,
  });
}

function emptyPopupResponse() {
  return NextResponse.json({
    popup: null,
    segment: null,
  });
}

async function guardRateLimit(auth: RequestAuthSuccess) {
  const rateLimit = await consumeRateLimit(auth.supabase, {
    scope: "smart-popups-next",
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

  return null;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  let userId: string | undefined;
  try {
    const auth = await requireRequestAuth(request, { allowDevBypass: false });

    if (!auth.ok) {
      return auth.errorResponse;
    }
    userId = auth.user.id;

    const limited = await guardRateLimit(auth);
    if (limited) return limited;

    const admin = createAdminClient();
    const result = await getNextSmartPopup({
      supabase: admin,
      userId: auth.user.id,
      locale: searchParams.get("locale"),
      surface: searchParams.get("surface"),
      route: searchParams.get("route"),
      timezone:
        searchParams.get("timezone") ??
        request.cookies.get("thinkfy_timezone")?.value ??
        null,
      commit: false,
    });

    return NextResponse.json(result);
  } catch (error) {
    logSmartPopupFailure(
      {
        method: "GET",
        userId,
        locale: searchParams.get("locale"),
        surface: searchParams.get("surface"),
        route: searchParams.get("route"),
        commit: false,
      },
      error
    );
    return emptyPopupResponse();
  }
}

export async function POST(request: NextRequest) {
  let userId: string | undefined;
  let locale: string | null = null;
  let surface: string | null = null;
  let route: string | null = null;
  let timezone: string | null = null;
  try {
    const auth = await requireRequestAuth(request, { allowDevBypass: false });

    if (!auth.ok) {
      return auth.errorResponse;
    }
    userId = auth.user.id;

    const limited = await guardRateLimit(auth);
    if (limited) return limited;

    const body = await readJsonObject(request, { maxBytes: 8 * 1024 });
    locale = getString(body, "locale", { maxLength: 8 }) ?? null;
    surface = getString(body, "surface", { maxLength: 32 }) ?? null;
    route = getString(body, "route", { maxLength: 500 }) ?? null;
    timezone =
      getString(body, "timezone", { maxLength: 100 }) ??
      request.cookies.get("thinkfy_timezone")?.value ??
      null;
    const admin = createAdminClient();
    const result = await getNextSmartPopup({
      supabase: admin,
      userId: auth.user.id,
      locale,
      surface,
      route,
      timezone,
      commit: true,
    });

    return NextResponse.json(result);
  } catch (error) {
    logSmartPopupFailure(
      {
        method: "POST",
        userId,
        locale,
        surface,
        route,
        commit: true,
      },
      error
    );
    return emptyPopupResponse();
  }
}
