import { NextResponse, type NextRequest } from "next/server";
import { requireRequestAuth } from "@/lib/api/request-auth";
import { requireClassManager, requireClubOwner } from "@/lib/api/class-manager-access";
import { materialRetrySchema } from "@/lib/api/class-lms/material-pipeline/contracts";
import { findVersionByIdempotency, getVersion, markVersionQueued } from "@/lib/api/class-lms/material-pipeline/repository";
import { enqueueMaterialProcessing } from "@/lib/queues/lms-materials";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest, { params }: { params: Promise<{ materialId: string }> }) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return auth.errorResponse;
  try {
    const { materialId } = await params;
    const input = materialRetrySchema.parse(await request.json());
    const version = await getVersion(auth.supabase, input.versionId);
    if (!version || version.material_id !== materialId) return NextResponse.json({ error: "Material version not found." }, { status: 404 });
    const material = await auth.supabase.from("lms_materials").select("id, club_id, scope_class_id").eq("id", materialId).maybeSingle();
    if (material.error) throw new Error(material.error.message);
    if (!material.data) return NextResponse.json({ error: "Material not found." }, { status: 404 });
    const actor = material.data.scope_class_id
      ? await requireClassManager(auth.supabase as never, material.data.scope_class_id)
      : { userId: await requireClubOwner(auth.supabase as never, material.data.club_id) };
    if (!actor.userId) throw new Error("Forbidden");
    const key = `lms-material:${material.data.club_id}:${actor.userId}:${input.idempotencyKey}`;
    const prior = await findVersionByIdempotency(auth.supabase, key);
    if (prior) return NextResponse.json({ ok: true, versionId: prior.id, status: prior.status, replay: true });
    const queued = await markVersionQueued(auth.supabase, version.id, version.checksum_sha256 ?? "");
    if (!queued) return NextResponse.json({ ok: true, versionId: version.id, status: version.status, replay: true });
    await enqueueMaterialProcessing({ materialId, versionId: queued.id, idempotencyKey: key });
    return NextResponse.json({ ok: true, versionId: queued.id, status: queued.status, replay: false });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not retry material conversion." }, { status: 500 });
  }
}
