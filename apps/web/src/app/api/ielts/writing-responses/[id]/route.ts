import { NextResponse, type NextRequest } from "next/server";

import { requireRequestAuth } from "@/lib/api/request-auth";
import {
  getWritingResponseForUser,
  toWritingResponseView,
} from "@/lib/api/ielts/writing-responses-repository";

/**
 * GET /api/ielts/writing-responses/[id] — poll a Writing response's scoring
 * status + transparent band report (WS-3.1). Ownership is enforced server-side.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return auth.errorResponse;

  const response = await getWritingResponseForUser(id, auth.user.id);
  if (!response) {
    return NextResponse.json(
      { error: "Writing response not found." },
      { status: 404 },
    );
  }
  return NextResponse.json(toWritingResponseView(response));
}
