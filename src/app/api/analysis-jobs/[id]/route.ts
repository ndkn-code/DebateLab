import { NextRequest, NextResponse } from "next/server";
import { getDevAuthBypassUserFromRequest } from "@/lib/dev-auth-bypass";
import { getAnalysisJobForUser } from "@/lib/practice-analysis/service";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const authUser = user
    ? { id: user.id, email: user.email ?? null }
    : getDevAuthBypassUserFromRequest(req);

  if (!authUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const readClient = tryCreateAdminClient() ?? supabase;
  const job = await getAnalysisJobForUser(readClient, authUser.id, id);
  if (!job) {
    return NextResponse.json({ error: "Analysis job not found." }, { status: 404 });
  }

  return NextResponse.json(job);
}
