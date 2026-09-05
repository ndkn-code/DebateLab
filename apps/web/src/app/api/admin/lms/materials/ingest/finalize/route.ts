import { NextResponse, type NextRequest } from "next/server";
import { requireRequestAuth } from "@/lib/api/request-auth";
import { materialFinalizeSchema } from "@/lib/api/class-lms/material-pipeline/contracts";
import { finalizeMaterialIngest } from "@/lib/api/class-lms/material-pipeline/service";
import { enqueueMaterialProcessing } from "@/lib/queues/lms-materials";
import { getVersion } from "@/lib/api/class-lms/material-pipeline/repository";
import { createAdminClient } from "@/lib/supabase/admin";
import { SHARED_LMS_MATERIALS_V1, LMS_QUESTION_IMPORT_COMPLIANCE_APPROVED, LMS_QUESTION_IMPORT_SERVER_ENABLED } from "@/lib/features";
import { consumeRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!SHARED_LMS_MATERIALS_V1)
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return auth.errorResponse;
  try {
    const parsed = materialFinalizeSchema.parse(await request.json());
    if (parsed.purpose === "question_import") {
      if (!LMS_QUESTION_IMPORT_SERVER_ENABLED || !LMS_QUESTION_IMPORT_COMPLIANCE_APPROVED)
        return NextResponse.json({ ok: false, error: "Question import is not enabled." }, { status: 404 });
      const rateLimit = await consumeRateLimit(auth.supabase, { scope: `lms-question-import:finalize:${auth.user.id}`, limit: 6, windowSeconds: 3600 });
      if (!rateLimit.success) return NextResponse.json({ ok: false, error: "Too many batch submissions.", retryAfterSeconds: rateLimit.retryAfterSeconds }, { status: 429 });
    }
    const before = await getVersion(createAdminClient(), parsed.ingestionId);
    if (!before)
      return NextResponse.json(
        { ok: false, error: "Material ingestion not found." },
        { status: 404 },
      );
    if ((before.purpose ?? "material") !== parsed.purpose)
      return NextResponse.json(
        { ok: false, error: "Material purpose does not match this request." },
        { status: 409 },
      );
    const version = await finalizeMaterialIngest(
      auth.supabase,
      parsed.ingestionId,
      parsed.sha256,
    );
    if (version.status === "queued") {
      await enqueueMaterialProcessing({
        materialId: version.material_id,
        versionId: version.id,
        idempotencyKey: version.idempotency_key,
      });
    }
    return NextResponse.json({
      ok: true,
      materialId: version.material_id,
      versionId: version.id,
      status: version.status,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Could not finalize material upload.";
    const status = /not found/i.test(message)
      ? 404
      : /match|missing|cannot be finalized|uploaded material/i.test(message)
        ? 409
        : 500;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
