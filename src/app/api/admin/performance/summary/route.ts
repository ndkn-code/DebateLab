import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAdminUser } from "@/lib/auth/admin";
import { consumeRateLimit } from "@/lib/rate-limit";
import {
  getPerformanceSummary,
  normalizePerformanceRange,
} from "@/lib/analytics/performance-summary";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await isAdminUser(supabase, user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rateLimit = await consumeRateLimit(supabase, {
    scope: "performance-summary",
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

  const range = normalizePerformanceRange(
    request.nextUrl.searchParams.get("range")
  );
  const summary = await getPerformanceSummary(supabase, range);
  return NextResponse.json(summary);
}
