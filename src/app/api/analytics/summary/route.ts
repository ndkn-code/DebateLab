import { NextRequest, NextResponse } from "next/server";
import { getAnalyticsPageData, normalizeRangePreset } from "@/lib/api/analytics-page";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const range = normalizeRangePreset(request.nextUrl.searchParams.get("range") ?? undefined);
  const data = await getAnalyticsPageData(user.id, range);

  return NextResponse.json(data);
}
