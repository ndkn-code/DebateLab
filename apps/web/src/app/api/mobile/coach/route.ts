import { NextRequest, NextResponse } from "next/server";

import {
  MobileCoachApiError,
  getMobileCoachHome,
} from "@/lib/api/mobile-coach";
import { requireRequestAuth } from "@/lib/api/request-auth";

export const dynamic = "force-dynamic";

function coachErrorResponse(error: unknown) {
  if (error instanceof MobileCoachApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status }
    );
  }

  if (process.env.NODE_ENV === "development") {
    console.error("Mobile coach home failed:", error);
  }

  return NextResponse.json(
    { error: "Unable to load coach.", code: "coach_unavailable" },
    { status: 500 }
  );
}

export async function GET(request: NextRequest) {
  const auth = await requireRequestAuth(request, { allowDevBypass: false });
  if (!auth.ok) return auth.errorResponse;

  try {
    const response = await getMobileCoachHome({
      contextId: request.nextUrl.searchParams.get("contextId"),
      contextType: request.nextUrl.searchParams.get("context"),
      message: request.nextUrl.searchParams.get("message"),
      practiceLanguageInput: request.nextUrl.searchParams.get("practiceLanguage"),
      supabase: auth.supabase,
      userId: auth.user.id,
    });

    return NextResponse.json(response);
  } catch (error) {
    return coachErrorResponse(error);
  }
}
