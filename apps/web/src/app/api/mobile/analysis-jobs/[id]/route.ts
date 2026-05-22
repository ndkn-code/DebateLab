import { NextRequest, NextResponse } from "next/server";

import { requireRequestAuth } from "@/lib/api/request-auth";
import { getAnalysisJobForUser } from "@/lib/practice-analysis/service";
import { tryCreateAdminClient } from "@/lib/supabase/admin";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireRequestAuth(req);

  if (!auth.ok) {
    return auth.errorResponse;
  }

  const readClient = tryCreateAdminClient() ?? auth.supabase;
  const job = await getAnalysisJobForUser(readClient, auth.user.id, id);
  if (!job) {
    return NextResponse.json(
      { error: "Analysis job not found.", code: "not_found" },
      { status: 404 }
    );
  }

  return NextResponse.json(job);
}
