import { NextRequest, NextResponse } from "next/server";
import { isAdminUser } from "@/lib/auth/admin";
import { requireRequestAuth } from "@/lib/api/request-auth";
import { tryCreateAdminClient } from "@/lib/supabase/admin";
import {
  AI_QUALITY_REVIEW_STATUSES,
  type AiQualityReviewStatus,
} from "@/lib/ai/quality-model";
import {
  getEnum,
  getString,
  isUuid,
  readJsonObject,
  RequestValidationError,
} from "@/lib/api/request-validation";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ runId: string }> }
) {
  try {
    const auth = await requireRequestAuth(req);
    if (!auth.ok) return auth.errorResponse;

    const { supabase, user } = auth;
    if (!(await isAdminUser(supabase, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { runId } = await context.params;
    if (!isUuid(runId)) {
      throw new RequestValidationError("runId is invalid.");
    }

    const body = await readJsonObject(req, { maxBytes: 8 * 1024 });
    const reviewStatus = getEnum(
      body,
      "reviewStatus",
      AI_QUALITY_REVIEW_STATUSES,
      { required: true }
    ) as AiQualityReviewStatus;
    const adminNotes = getString(body, "adminNotes", { maxLength: 2000 });

    const admin = tryCreateAdminClient() ?? supabase;
    const { data, error } = await admin
      .from("ai_quality_runs")
      .update({
        review_status: reviewStatus,
        admin_notes: adminNotes ?? null,
        reviewed_by: auth.authSource === "dev-bypass" ? null : user.id,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", runId)
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: "Unable to update AI quality run" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, run: data });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: "Unable to update AI quality run" },
      { status: 500 }
    );
  }
}
