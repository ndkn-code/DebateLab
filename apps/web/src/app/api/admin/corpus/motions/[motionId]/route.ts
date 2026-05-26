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
import {
  MOTION_REVIEW_STATUSES,
  createMotionCandidatePatch,
  publishCorpusMotionCandidate,
} from "@/lib/corpus/admin";

const CATEGORY_KEYS = [
  "education",
  "technology",
  "society",
  "environment",
  "ethics",
] as const;
const DIFFICULTIES = ["beginner", "intermediate", "advanced"] as const;

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ motionId: string }> }
) {
  try {
    const auth = await requireRequestAuth(req);
    if (!auth.ok) return auth.errorResponse;
    const { supabase, user } = auth;
    if (!(await isAdminUser(supabase, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const { motionId } = await context.params;
    if (!isUuid(motionId)) throw new RequestValidationError("motionId is invalid.");

    const body = await readJsonObject(req, { maxBytes: 128 * 1024 });
    const action = getEnum(body, "action", ["update", "publish"] as const, {
      defaultValue: "update",
    });
    const admin = tryCreateAdminClient() ?? supabase;
    if (action === "publish") {
      const result = await publishCorpusMotionCandidate({
        supabase: admin,
        motionId,
        reviewedBy: auth.authSource === "dev-bypass" ? null : user.id,
      });
      return NextResponse.json({ ok: true, ...result });
    }

    const reviewStatus = getEnum(body, "reviewStatus", MOTION_REVIEW_STATUSES);
    const motionVi = getString(body, "motionVi", { maxLength: 600 });
    const motionEn = getString(body, "motionEn", { maxLength: 600 });
    const categoryKey = getEnum(body, "categoryKey", CATEGORY_KEYS);
    const difficulty = getEnum(body, "difficulty", DIFFICULTIES);
    const adminNotes = getString(body, "adminNotes", { maxLength: 4000 });
    const qualityFlags = getJsonRecord(body, "qualityFlags", { maxBytes: 16 * 1024 });

    const { data, error } = await admin
      .from("debate_corpus_motion_candidates")
      .update(
        createMotionCandidatePatch({
          motionVi,
          motionEn,
          categoryKey,
          difficulty,
          reviewStatus,
          adminNotes,
          qualityFlags,
          reviewerId: auth.authSource === "dev-bypass" ? null : user.id,
        })
      )
      .eq("id", motionId)
      .select("*")
      .single();
    if (error) {
      return NextResponse.json({ error: "Unable to update motion" }, { status: 500 });
    }
    return NextResponse.json({ ok: true, motion: data });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update motion" },
      { status: 500 }
    );
  }
}
