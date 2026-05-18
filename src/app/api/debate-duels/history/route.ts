import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDebateDuelHistory } from "@/lib/api/debate-duels";
import { getDevAuthBypassUserFromRequest } from "@/lib/dev-auth-bypass";
import { coercePracticeLanguage } from "@/lib/practice-language";

export async function GET(request: NextRequest) {
  try {
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

    const practiceLanguage = coercePracticeLanguage(
      request.nextUrl.searchParams.get("language")
    );
    const history = await getDebateDuelHistory(userId, practiceLanguage);
    return NextResponse.json(history);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load duel history.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
