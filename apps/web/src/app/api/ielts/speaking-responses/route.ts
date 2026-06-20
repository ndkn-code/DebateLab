import { NextResponse, type NextRequest } from "next/server";

import { requireRequestAuth } from "@/lib/api/request-auth";
import { RequestValidationError } from "@/lib/api/request-validation";
import { SpeakingResponseAccessError } from "@/lib/api/ielts/speaking-responses-repository";
import {
  SpeakingScoreLimitError,
  submitSpeakingResponseForScoring,
} from "@/lib/ielts/speaking-scorer/service";

/**
 * POST /api/ielts/speaking-responses — submit a recording for async AI band
 * scoring (WS-3.2). Meters the request, persists the response, and enqueues the
 * job; the client then polls GET /api/ielts/speaking-responses/[id]. Audio
 * capture/upload is out of scope — the body references an audioStoragePath.
 */
export async function POST(request: NextRequest) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return auth.errorResponse;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const result = await submitSpeakingResponseForScoring({
      raw: body,
      userId: auth.user.id,
      supabase: auth.supabase,
    });
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof SpeakingResponseAccessError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof SpeakingScoreLimitError) {
      return NextResponse.json({ error: error.message }, { status: 402 });
    }
    console.error("IELTS speaking submit failed", error);
    return NextResponse.json(
      { error: "Failed to submit speaking response for scoring." },
      { status: 500 },
    );
  }
}
