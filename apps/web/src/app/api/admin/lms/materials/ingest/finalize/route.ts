import { NextResponse, type NextRequest } from "next/server";
import { requireRequestAuth } from "@/lib/api/request-auth";
import { materialFinalizeSchema } from "@/lib/api/class-lms/material-pipeline/contracts";
import { finalizeMaterialIngest } from "@/lib/api/class-lms/material-pipeline/service";
import { enqueueMaterialProcessing } from "@/lib/queues/lms-materials";
import { getVersion } from "@/lib/api/class-lms/material-pipeline/repository";
import { SHARED_LMS_MATERIALS_V1 } from "@/lib/features";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  if (!SHARED_LMS_MATERIALS_V1)
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return auth.errorResponse;
  try {
    const parsed = materialFinalizeSchema.parse(await request.json());
    const before = await getVersion(auth.supabase, parsed.ingestionId);
    if (!before)
      return NextResponse.json(
        { ok: false, error: "Material ingestion not found." },
        { status: 404 },
      );
    const visible = await auth.supabase
      .from("lms_materials")
      .select("id")
      .eq("id", before.material_id)
      .maybeSingle();
    if (visible.error) throw new Error(visible.error.message);
    if (!visible.data)
      return NextResponse.json(
        { ok: false, error: "Material ingestion not found." },
        { status: 404 },
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
