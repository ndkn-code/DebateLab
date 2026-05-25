import { NextRequest, NextResponse } from "next/server";
import { isAdminUser } from "@/lib/auth/admin";
import { requireRequestAuth } from "@/lib/api/request-auth";
import {
  RequestValidationError,
  getEnum,
  getJsonRecord,
  getNumber,
  getString,
  getStringArray,
  isUuid,
  readJsonObject,
} from "@/lib/api/request-validation";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { CORPUS_REVIEW_STATUSES } from "@/lib/corpus/admin";
import {
  DEBATE_CORPUS_SAFE_EVIDENCE_STATUSES,
  DEBATE_CORPUS_USABLE_FOR,
  hashDebateCorpusContent,
} from "@/lib/corpus/model";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ itemId: string }> }
) {
  try {
    const auth = await requireRequestAuth(req);
    if (!auth.ok) return auth.errorResponse;
    const { supabase, user } = auth;
    if (!(await isAdminUser(supabase, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { itemId } = await context.params;
    if (!isUuid(itemId)) throw new RequestValidationError("itemId is invalid.");

    const body = await readJsonObject(req, { maxBytes: 256 * 1024 });
    const reviewStatus = getEnum(body, "reviewStatus", CORPUS_REVIEW_STATUSES);
    const evidenceStatus = getEnum(
      body,
      "evidenceStatus",
      [
        ...DEBATE_CORPUS_SAFE_EVIDENCE_STATUSES,
        "uncertain_stt",
      ] as const
    );
    const adminNotes = getString(body, "adminNotes", { maxLength: 4000 });
    const embeddingText = getString(body, "embeddingText", { maxLength: 12000 });
    const confidence = getNumber(body, "confidence", { min: 0, max: 1 });
    const usableFor = getStringArray(body.usableFor, "usableFor", {
      maxItems: 5,
      maxItemLength: 32,
    }).filter((item) => (DEBATE_CORPUS_USABLE_FOR as readonly string[]).includes(item));
    const qualityFlags = getJsonRecord(body, "qualityFlags", { maxBytes: 16 * 1024 });
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (reviewStatus) {
      patch.review_status = reviewStatus;
      patch.reviewed_by = auth.authSource === "dev-bypass" ? null : user.id;
      patch.reviewed_at = new Date().toISOString();
    }
    if (evidenceStatus) patch.evidence_status = evidenceStatus;
    if (adminNotes !== undefined) patch.admin_notes = adminNotes || null;
    if (confidence !== undefined) patch.confidence = confidence;
    if (usableFor.length) patch.usable_for = usableFor;
    if (embeddingText) {
      patch.embedding_text = embeddingText;
      patch.content_hash = hashDebateCorpusContent({ embeddingText });
    }
    if (Object.keys(qualityFlags).length) patch.quality_flags = qualityFlags;

    const admin = tryCreateAdminClient() ?? supabase;
    const { data, error } = await admin
      .from("debate_corpus_items")
      .update(patch)
      .eq("id", itemId)
      .select("*")
      .single();
    if (error) {
      return NextResponse.json({ error: "Unable to update item" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, item: data });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to update item" }, { status: 500 });
  }
}
