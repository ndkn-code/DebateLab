import { NextResponse, type NextRequest } from "next/server";

import { requireRequestAuth } from "@/lib/api/request-auth";
import {
  getSpeakingResponseForUser,
  toSpeakingResponseView,
} from "@/lib/api/ielts/speaking-responses-repository";
import { scheduleIeltsSpeakingScoringFallback } from "@/lib/ielts/speaking-scorer/service";

export const maxDuration = 120;

function shouldScheduleFallback(status: string): boolean {
  return status === "pending" || status === "failed" || status === "scoring";
}

/**
 * GET /api/ielts/speaking-responses/[id] — poll a Speaking response's scoring
 * status + transcript + transparent 4-criteria band report (WS-3.2). Ownership
 * is enforced server-side.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return auth.errorResponse;

  const response = await getSpeakingResponseForUser(id, auth.user.id);
  if (!response) {
    return NextResponse.json(
      { error: "Speaking response not found." },
      { status: 404 },
    );
  }
  if (shouldScheduleFallback(response.status)) {
    scheduleIeltsSpeakingScoringFallback(
      { speakingResponseId: response.id, userId: auth.user.id },
      "poll",
    );
  }
  return NextResponse.json(toSpeakingResponseView(response));
}
