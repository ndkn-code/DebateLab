import { NextRequest, NextResponse } from "next/server";
import { getDebateDuelHistory } from "@/lib/api/debate-duels";
import { requireRequestAuth } from "@/lib/api/request-auth";
import { coercePracticeLanguage } from "@/lib/practice-language";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireRequestAuth(request);

    if (!auth.ok) {
      return auth.errorResponse;
    }

    const practiceLanguage = coercePracticeLanguage(
      request.nextUrl.searchParams.get("language")
    );
    const history = await getDebateDuelHistory(auth.user.id, practiceLanguage);
    return NextResponse.json(history);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load duel history.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
