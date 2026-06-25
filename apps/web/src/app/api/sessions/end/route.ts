import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireRequestAuth } from "@/lib/api/request-auth";
import {
  RequestValidationError,
  readJsonObject,
} from "@/lib/api/request-validation";

export const dynamic = "force-dynamic";

const endSessionSchema = z.object({
  sessionId: z.string().trim().min(1).max(64),
});

export async function POST(request: NextRequest) {
  const auth = await requireRequestAuth(request);

  if (!auth.ok) {
    return auth.errorResponse;
  }

  if (auth.authSource === "dev-bypass") {
    return new NextResponse(null, { status: 204 });
  }

  let sessionId: string | undefined;
  try {
    const body = await readJsonObject(request, { maxBytes: 1024 });
    sessionId = endSessionSchema.parse(body).sessionId;
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof z.ZodError
            ? "Invalid session end payload."
            : error instanceof Error
              ? error.message
              : "Invalid session end payload",
      },
      { status: error instanceof RequestValidationError ? error.status : 400 }
    );
  }

  if (!sessionId) {
    return NextResponse.json(
      { error: "sessionId is required." },
      { status: 400 }
    );
  }

  const endedAt = new Date().toISOString();
  const { error } = await auth.supabase
    .from("user_sessions")
    .update({
      is_active: false,
      last_seen_at: endedAt,
      session_end: endedAt,
    })
    .eq("id", sessionId)
    .eq("user_id", auth.user.id);

  if (error) {
    return NextResponse.json(
      { error: "Unable to end session." },
      { status: 500 }
    );
  }

  return new NextResponse(null, { status: 204 });
}
