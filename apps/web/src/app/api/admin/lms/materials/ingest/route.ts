import { NextResponse, type NextRequest } from "next/server";
import { requireRequestAuth } from "@/lib/api/request-auth";
import {
  requireClassManager,
  requireClubOwner,
} from "@/lib/api/class-manager-access";
import { materialIngestSchema } from "@/lib/api/class-lms/material-pipeline/contracts";
import { createMaterialIngest } from "@/lib/api/class-lms/material-pipeline/service";
import { SHARED_LMS_MATERIALS_V1, LMS_QUESTION_IMPORT_COMPLIANCE_APPROVED, LMS_QUESTION_IMPORT_SERVER_ENABLED } from "@/lib/features";
import { consumeRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

async function requireManager(
  auth: Extract<Awaited<ReturnType<typeof requireRequestAuth>>, { ok: true }>,
  clubId: string,
  classId: string | null,
) {
  if (classId) {
    const context = await requireClassManager(auth.supabase as never, classId);
    if (context.clubId !== clubId)
      throw new Error("Class does not belong to this organisation.");
    return context.userId;
  }
  return requireClubOwner(auth.supabase as never, clubId);
}

async function requireQuestionImportManager(auth: Extract<Awaited<ReturnType<typeof requireRequestAuth>>, { ok: true }>, clubId: string) {
  const membership = await auth.supabase.from("club_memberships").select("role").eq("club_id", clubId).eq("user_id", auth.user.id).eq("status", "active").maybeSingle();
  if (membership.error) throw new Error(membership.error.message);
  if (!membership.data || !["owner", "admin", "head_teacher", "teacher"].includes(String(membership.data.role))) throw new Error("You do not have permission to import questions for this organisation.");
  return auth.user.id;
}

export async function POST(request: NextRequest) {
  if (!SHARED_LMS_MATERIALS_V1)
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return auth.errorResponse;
  try {
    const parsed = materialIngestSchema.parse(await request.json());
    if (parsed.purpose === "question_import") {
      if (!LMS_QUESTION_IMPORT_SERVER_ENABLED || !LMS_QUESTION_IMPORT_COMPLIANCE_APPROVED)
        return NextResponse.json({ ok: false, error: "Question import is not enabled." }, { status: 404 });
      const rateLimit = await consumeRateLimit(auth.supabase, { scope: `lms-question-import:prepare:${auth.user.id}`, limit: 10, windowSeconds: 600 });
      if (!rateLimit.success) return NextResponse.json({ ok: false, error: "Too many upload preparations.", retryAfterSeconds: rateLimit.retryAfterSeconds }, { status: 429 });
      if (!parsed.questionImport?.rightsAttested) throw new Error("Rights attestation is required.");
    }
    const actorId = parsed.purpose === "question_import"
      ? await requireQuestionImportManager(auth, parsed.clubId)
      : await requireManager(auth, parsed.clubId, parsed.scopeClassId ?? null);
    const result = await createMaterialIngest(auth.supabase, parsed, actorId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not prepare material upload.";
    const status = /forbidden|unauthorized/i.test(message)
      ? 403
      : /invalid|too large|unsupported|required/i.test(message)
        ? 400
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
