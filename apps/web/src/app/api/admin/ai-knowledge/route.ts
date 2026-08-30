import { NextRequest, NextResponse } from "next/server";

import { isAdminUser } from "@/lib/auth/admin";
import { requireRequestAuth } from "@/lib/api/request-auth";
import {
  listAiKnowledgeForAdmin,
  reviewAiKnowledgeRecord,
} from "@/lib/ai/knowledge/admin";
import {
  KNOWLEDGE_AUTHORITY_TIERS,
  KNOWLEDGE_RIGHTS_STATUSES,
} from "@/lib/ai/knowledge/ingestion";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import {
  RequestValidationError,
  getEnum,
  getString,
  isUuid,
  readJsonObject,
} from "@/lib/api/request-validation";

export const dynamic = "force-dynamic";

const RECORD_KINDS = ["source", "item"] as const;
const REVIEW_STATUSES = [
  "candidate",
  "needs_review",
  "approved",
  "rejected",
] as const;

async function requireAdmin(request: NextRequest) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return auth;
  if (!(await isAdminUser(auth.supabase as never, auth.user.id))) {
    return {
      ok: false as const,
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return auth;
}

export async function GET(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.errorResponse;
  const params = new URL(request.url).searchParams;
  const collection = params.get("collection");
  if (!collection)
    return NextResponse.json(
      { error: "collection is required" },
      { status: 400 },
    );
  const rawLimit = Number(params.get("limit") ?? 100);
  try {
    const payload = await listAiKnowledgeForAdmin({
      supabase: tryCreateAdminClient() ?? auth.supabase,
      collection,
      reviewStatus: params.get("reviewStatus"),
      limit: Number.isFinite(rawLimit) ? rawLimit : 100,
    });
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to load AI knowledge",
      },
      { status: 400 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.errorResponse;
    const body = await readJsonObject(request, { maxBytes: 32 * 1024 });
    const kind = getEnum(body, "kind", RECORD_KINDS);
    const id = getString(body, "id", { maxLength: 64 });
    const reviewStatus = getEnum(body, "reviewStatus", REVIEW_STATUSES);
    const authorityTier = getEnum(
      body,
      "authorityTier",
      KNOWLEDGE_AUTHORITY_TIERS,
    );
    const rightsStatus = getEnum(
      body,
      "rightsStatus",
      KNOWLEDGE_RIGHTS_STATUSES,
    );
    const reviewNotes = getString(body, "reviewNotes", { maxLength: 4000 });
    if (!kind || !id || !reviewStatus || !isUuid(id)) {
      throw new RequestValidationError(
        "kind, UUID id, and reviewStatus are required.",
      );
    }
    const record = await reviewAiKnowledgeRecord({
      supabase: tryCreateAdminClient() ?? auth.supabase,
      kind,
      id,
      reviewStatus,
      reviewerId: auth.user.id,
      reviewNotes,
      authorityTier,
      rightsStatus,
    });
    return NextResponse.json({ ok: true, record });
  } catch (error) {
    const status = error instanceof RequestValidationError ? error.status : 400;
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to review AI knowledge",
      },
      { status },
    );
  }
}
