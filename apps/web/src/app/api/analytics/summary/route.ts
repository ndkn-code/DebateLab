import { NextRequest, NextResponse } from "next/server";
import { getAnalyticsPageData, normalizeRangePreset } from "@/lib/api/analytics-page";
import {
  requireRequestAuth,
  shouldConsumeUserRateLimit,
} from "@/lib/api/request-auth";
import { consumeRateLimit } from "@/lib/rate-limit";
import { coercePracticeLanguage } from "@/lib/practice-language";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireRequestAuth(request);

  if (!auth.ok) {
    return auth.errorResponse;
  }

  if (shouldConsumeUserRateLimit(auth)) {
    const rateLimit = await consumeRateLimit(auth.supabase, {
      scope: "analytics-summary",
      limit: 30,
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

  const range = normalizeRangePreset(request.nextUrl.searchParams.get("range") ?? undefined);
  const practiceLanguage = coercePracticeLanguage(
    request.nextUrl.searchParams.get("language")
  );
  const data = await getAnalyticsPageData(auth.user.id, range, practiceLanguage);

  return NextResponse.json(data);
}
