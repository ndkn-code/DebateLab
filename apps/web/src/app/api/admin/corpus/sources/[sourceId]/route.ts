import { NextRequest, NextResponse } from "next/server";
import { isAdminUser } from "@/lib/auth/admin";
import { requireRequestAuth } from "@/lib/api/request-auth";
import {
  RequestValidationError,
  getEnum,
  getJsonRecord,
  getString,
  readJsonObject,
} from "@/lib/api/request-validation";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import { CORPUS_REVIEW_STATUSES } from "@/lib/corpus/admin";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ sourceId: string }> }
) {
  try {
    const auth = await requireRequestAuth(req);
    if (!auth.ok) return auth.errorResponse;

    const { supabase, user } = auth;
    if (!(await isAdminUser(supabase, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { sourceId } = await context.params;
    const body = await readJsonObject(req, { maxBytes: 64 * 1024 });
    const reviewStatus = getEnum(body, "reviewStatus", CORPUS_REVIEW_STATUSES);
    const adminNotes = getString(body, "adminNotes", { maxLength: 4000 });
    const qualityFlags = getJsonRecord(body, "qualityFlags", { maxBytes: 16 * 1024 });
    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (reviewStatus) {
      patch.review_status = reviewStatus;
      patch.reviewed_by = auth.authSource === "dev-bypass" ? null : user.id;
      patch.reviewed_at = new Date().toISOString();
    }
    if (adminNotes !== undefined) patch.admin_notes = adminNotes || null;
    if (Object.keys(qualityFlags).length) patch.quality_flags = qualityFlags;

    const admin = tryCreateAdminClient() ?? supabase;
    const { data, error } = await admin
      .from("debate_corpus_sources")
      .update(patch)
      .eq("id", sourceId)
      .select("*")
      .single();
    if (error) {
      return NextResponse.json({ error: "Unable to update source" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, source: data });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json({ error: "Unable to update source" }, { status: 500 });
  }
}
