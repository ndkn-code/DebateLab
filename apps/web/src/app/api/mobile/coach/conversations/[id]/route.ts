import { NextRequest, NextResponse } from "next/server";

import {
  MobileCoachApiError,
  getMobileCoachConversation,
  isUuid,
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
    console.error("Mobile coach conversation failed:", error);
  }

  return NextResponse.json(
    { error: "Unable to load coach conversation.", code: "coach_unavailable" },
    { status: 500 }
  );
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRequestAuth(request, { allowDevBypass: false });
  if (!auth.ok) return auth.errorResponse;

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json(
      { error: "Conversation not found.", code: "not_found" },
      { status: 404 }
    );
  }

  try {
    const response = await getMobileCoachConversation({
      conversationId: id,
      supabase: auth.supabase,
      userId: auth.user.id,
    });

    return NextResponse.json(response);
  } catch (error) {
    return coachErrorResponse(error);
  }
}
