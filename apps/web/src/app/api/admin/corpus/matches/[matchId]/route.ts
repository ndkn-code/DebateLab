import { NextRequest, NextResponse } from "next/server";
import { isAdminUser } from "@/lib/auth/admin";
import { requireRequestAuth } from "@/lib/api/request-auth";
import {
  RequestValidationError,
  getEnum,
  getJsonRecord,
  getString,
  isUuid,
  readJsonObject,
} from "@/lib/api/request-validation";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { CORPUS_REVIEW_STATUSES } from "@/lib/corpus/admin";

const IMPORT_DECISIONS = ["candidate", "phrase_only", "metadata_only", "reject"] as const;

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ matchId: string }> }
) {
  try {
    const auth = await requireRequestAuth(req);
    if (!auth.ok) return auth.errorResponse;
    const { supabase, user } = auth;
    if (!(await isAdminUser(supabase, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { matchId } = await context.params;
    if (!isUuid(matchId)) throw new RequestValidationError("matchId is invalid.");

    const body = await readJsonObject(req, { maxBytes: 128 * 1024 });
    const reviewStatus = getEnum(body, "reviewStatus", CORPUS_REVIEW_STATUSES);
    const importDecision = getEnum(body, "importDecision", IMPORT_DECISIONS);
    const adminNotes = getString(body, "adminNotes", { maxLength: 4000 });
    const motionVi = getString(body, "motionVi", { maxLength: 600 });
    const motionEn = getString(body, "motionEn", { maxLength: 600 });
    const qualityFlags = getJsonRecord(body, "qualityFlags", { maxBytes: 16 * 1024 });
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (reviewStatus) {
      patch.review_status = reviewStatus;
      patch.reviewed_by = auth.authSource === "dev-bypass" ? null : user.id;
      patch.reviewed_at = new Date().toISOString();
    }
    if (importDecision) patch.import_decision = importDecision;
    if (adminNotes !== undefined) patch.admin_notes = adminNotes || null;
    if (motionVi) patch.motion_vi = motionVi;
    if (motionEn !== undefined) patch.motion_en = motionEn || null;
    if (Object.keys(qualityFlags).length) patch.quality_flags = qualityFlags;

    const admin = tryCreateAdminClient() ?? supabase;
    const { data, error } = await admin
      .from("debate_corpus_matches")
      .update(patch)
      .eq("id", matchId)
      .select("*")
      .single();
    if (error) {
      return NextResponse.json({ error: "Unable to update match" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, match: data });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to update match" }, { status: 500 });
  }
}
