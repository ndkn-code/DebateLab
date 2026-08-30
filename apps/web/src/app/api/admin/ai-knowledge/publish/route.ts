import { NextRequest, NextResponse } from "next/server";

import { isAdminUser } from "@/lib/auth/admin";
import { requireRequestAuth } from "@/lib/api/request-auth";
import { publishAiKnowledgeVersion } from "@/lib/ai/knowledge/admin";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import {
  RequestValidationError,
  getNumber,
  getString,
  readJsonObject,
} from "@/lib/api/request-validation";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const auth = await requireRequestAuth(request);
    if (!auth.ok) return auth.errorResponse;
    if (!(await isAdminUser(auth.supabase as never, auth.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const body = await readJsonObject(request, { maxBytes: 16 * 1024 });
    const collection = getString(body, "collection", { maxLength: 120 });
    const version = getNumber(body, "version", { min: 1, max: 1_000_000 });
    const reviewNotes = getString(body, "reviewNotes", { maxLength: 4000 });
    if (!collection || version === undefined || !Number.isInteger(version)) {
      throw new RequestValidationError(
        "collection and integer version are required.",
      );
    }
    const published = await publishAiKnowledgeVersion({
      supabase: tryCreateAdminClient() ?? auth.supabase,
      collection,
      version,
      reviewerId: auth.user.id,
      reviewNotes,
    });
    return NextResponse.json({ ok: true, published });
  } catch (error) {
    const status = error instanceof RequestValidationError ? error.status : 400;
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to publish AI knowledge",
      },
      { status },
    );
  }
}
