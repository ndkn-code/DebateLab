import { NextResponse, type NextRequest } from "next/server";
import { requireRequestAuth } from "@/lib/api/request-auth";
import { materialRetrySchema } from "@/lib/api/class-lms/material-pipeline/contracts";
import {
  getVersion,
  markVersionQueued,
} from "@/lib/api/class-lms/material-pipeline/repository";
import { enqueueMaterialProcessing } from "@/lib/queues/lms-materials";
import {
  requireMaterialManager,
  requireQuestionImportMaterialManager,
} from "@/lib/api/class-lms/material-pipeline/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { SHARED_LMS_MATERIALS_V1, LMS_QUESTION_IMPORT_COMPLIANCE_APPROVED, LMS_QUESTION_IMPORT_SERVER_ENABLED } from "@/lib/features";
import { consumeRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ materialId: string }> },
) {
  if (!SHARED_LMS_MATERIALS_V1)
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return auth.errorResponse;
  try {
    const { materialId } = await params;
    const input = materialRetrySchema.parse(await request.json());
    if (input.purpose === "question_import") {
      if (!LMS_QUESTION_IMPORT_SERVER_ENABLED || !LMS_QUESTION_IMPORT_COMPLIANCE_APPROVED)
        return NextResponse.json({ ok: false, error: "Question import is not enabled." }, { status: 404 });
      const rateLimit = await consumeRateLimit(auth.supabase, { scope: `lms-question-import:retry:${auth.user.id}:${input.versionId}`, limit: 3, windowSeconds: 86400 });
      if (!rateLimit.success) return NextResponse.json({ ok: false, error: "Retry limit reached.", retryAfterSeconds: rateLimit.retryAfterSeconds }, { status: 429 });
    }
    const admin = createAdminClient();
    const version = await getVersion(admin, input.versionId);
    if (!version || version.material_id !== materialId)
      return NextResponse.json(
        { error: "Material version not found." },
        { status: 404 },
      );
    if ((version.purpose ?? "material") !== input.purpose)
      return NextResponse.json(
        { error: "Material purpose does not match this request." },
        { status: 409 },
      );
    const material = await admin
      .from("lms_materials")
      .select("id, club_id, scope_class_id")
      .eq("id", materialId)
      .maybeSingle();
    if (material.error) throw new Error(material.error.message);
    if (!material.data)
      return NextResponse.json(
        { error: "Material not found." },
        { status: 404 },
      );
    const actor = input.purpose === "question_import"
      ? await requireQuestionImportMaterialManager(
          auth.supabase,
          materialId,
          version.id,
        )
      : await requireMaterialManager(auth.supabase, materialId);
    const key = `lms-material:${material.data.club_id}:${actor.actorId}:${input.idempotencyKey}`;
    if (version.status !== "failed" || !version.original_path)
      return NextResponse.json(
        {
          ok: false,
          error: "Only retryable conversion failures can be retried.",
        },
        { status: 409 },
      );
    const queued = await markVersionQueued(
      admin,
      version.id,
      version.sha256 ?? "",
      version.detected_mime_type ?? version.source_mime_type ?? "",
    );
    if (!queued)
      return NextResponse.json({
        ok: true,
        versionId: version.id,
        status: version.status,
        replay: true,
      });
    await enqueueMaterialProcessing({
      materialId,
      versionId: queued.id,
      idempotencyKey: key,
    });
    return NextResponse.json({
      ok: true,
      versionId: queued.id,
      status: queued.status,
      replay: false,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not retry material conversion.",
      },
      { status: 500 },
    );
  }
}
