import { NextResponse, type NextRequest } from "next/server";

import { requireRequestAuth } from "@/lib/api/request-auth";
import { RequestValidationError } from "@/lib/api/request-validation";
import { WritingResponseAccessError } from "@/lib/api/ielts/writing-responses-repository";
import {
  WritingScoreLimitError,
  submitWritingResponseForScoring,
} from "@/lib/ielts/writing-scorer/service";

/**
 * POST /api/ielts/writing-responses — submit an essay for async AI band scoring
 * (WS-3.1). Meters the request, persists the response, and enqueues the job;
 * the client then polls GET /api/ielts/writing-responses/[id].
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
    const result = await submitWritingResponseForScoring({
      raw: body,
      userId: auth.user.id,
      supabase: auth.supabase,
    });
    return NextResponse.json(result, { status: 202 });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof WritingResponseAccessError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof WritingScoreLimitError) {
      return NextResponse.json({ error: error.message }, { status: 402 });
    }
    console.error("IELTS writing submit failed", error);
    return NextResponse.json(
      { error: "Failed to submit writing response for scoring." },
      { status: 500 },
    );
  }
}
