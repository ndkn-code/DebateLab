import { NextRequest, NextResponse } from "next/server";
import { getAnalyticsPageData, normalizeRangePreset } from "@/lib/api/analytics-page";
import { createClient } from "@/lib/supabase/server";
import { getDevAuthBypassUserFromRequest } from "@/lib/dev-auth-bypass";
import { consumeRateLimit } from "@/lib/rate-limit";
import { coercePracticeLanguage } from "@/lib/practice-language";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const devAuthBypassUser = user
    ? null
    : getDevAuthBypassUserFromRequest(request);
  const userId = user?.id ?? devAuthBypassUser?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user) {
    const rateLimit = await consumeRateLimit(supabase, {
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
  const data = await getAnalyticsPageData(userId, range, practiceLanguage);

  return NextResponse.json(data);
}
