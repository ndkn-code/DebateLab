import { NextResponse, type NextRequest } from "next/server";

import { requireRequestAuth } from "@/lib/api/request-auth";
import {
  getSpeakingResponseForUser,
  type SpeakingResponseRow,
  toSpeakingResponseView,
} from "@/lib/api/ielts/speaking-responses-repository";
import { scheduleIeltsSpeakingScoringFallback } from "@/lib/ielts/speaking-scorer/service";
import { IELTS_SPEAKING_STALE_SCORING_MS } from "@/lib/ielts/speaking-scorer/constants";

export const maxDuration = 120;

const POLL_FALLBACK_DELAY_MS = 15_000;

function ageMs(updatedAt: string | null): number {
  const timestamp = updatedAt ? Date.parse(updatedAt) : NaN;
  if (!Number.isFinite(timestamp)) return Number.POSITIVE_INFINITY;
  return Date.now() - timestamp;
}

function shouldScheduleFallback(response: SpeakingResponseRow): boolean {
  const rowAgeMs = ageMs(response.updated_at);
  if (response.status === "pending" || response.status === "failed") {
    return rowAgeMs >= POLL_FALLBACK_DELAY_MS;
  }
  if (response.status === "scoring") {
    return rowAgeMs >= IELTS_SPEAKING_STALE_SCORING_MS;
  }
  return false;
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
  if (shouldScheduleFallback(response)) {
    scheduleIeltsSpeakingScoringFallback(
      { speakingResponseId: response.id, userId: auth.user.id },
      "poll",
    );
  }
  return NextResponse.json(toSpeakingResponseView(response));
}
