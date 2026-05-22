import { NextRequest, NextResponse } from "next/server";
import { getAdminUserAnalyticsProfile } from "@/lib/analytics/admin-user-analytics";
import { createClient } from "@/lib/supabase/server";
import { isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isDevAdminBypassEnabled()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await getAdminUserAnalyticsProfile(
      user?.id ?? null,
      userId,
      request.nextUrl.searchParams.get("range")
    );
    return NextResponse.json(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load user analytics";
    const status = message === "Forbidden" ? 403 : message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
