import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getDevAuthBypassUserFromRequest } from "@/lib/dev-auth-bypass";
import {
  getCoachContextEnvelope,
  getCoachProfile,
} from "@/lib/api/coach-profile";
import { coercePracticeLanguage } from "@/lib/practice-language";

function normalizeContextType(context?: string | null) {
  if (!context) return undefined;
  return context === "dashboard-home" ? "coach-home" : context;
}

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const devAuthBypassUser = user
      ? null
      : getDevAuthBypassUserFromRequest(req);
    const userId = user?.id ?? devAuthBypassUser?.id;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = req.nextUrl.searchParams;
    const contextType = normalizeContextType(searchParams.get("contextType"));
    const contextId = searchParams.get("contextId");
    const message = searchParams.get("message");
    const practiceLanguage = coercePracticeLanguage(
      searchParams.get("practiceLanguage")
    );

    const profile = await getCoachProfile(userId, practiceLanguage);
    const envelope = await getCoachContextEnvelope({
      userId,
      profile,
      contextType,
      contextId,
      message,
      practiceLanguage,
    });

    return NextResponse.json({ profile, envelope });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to load coach profile:", error);
    }

    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}
