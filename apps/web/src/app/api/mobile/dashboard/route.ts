import { NextResponse, type NextRequest } from "next/server";

import { getDashboardData } from "@/lib/api/dashboard";
import { requireRequestAuth } from "@/lib/api/request-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return auth.errorResponse;

  const timezone = request.nextUrl.searchParams.get("timezone");
  const data = await getDashboardData(auth.user.id, auth.supabase, { timezone });

  return NextResponse.json({
    ok: true,
    authSource: auth.authSource,
    data,
  });
}
