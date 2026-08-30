import { NextResponse, type NextRequest } from "next/server";
import { requireRequestAuth } from "@/lib/api/request-auth";
import { getVersion } from "@/lib/api/class-lms/material-pipeline/repository";
import { requireMaterialManager } from "@/lib/api/class-lms/material-pipeline/service";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ materialId: string }> }) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return auth.errorResponse;
  try {
    const { materialId } = await params;
    await requireMaterialManager(auth.supabase, materialId);
    const material = await auth.supabase.from("lms_materials").select("id, status, title, pinned_version_id").eq("id", materialId).maybeSingle();
    if (material.error) throw new Error(material.error.message);
    if (!material.data) return NextResponse.json({ error: "Material not found." }, { status: 404 });
    const versionId = typeof material.data.pinned_version_id === "string" ? material.data.pinned_version_id : request.nextUrl.searchParams.get("versionId");
    const version = versionId ? await getVersion(createAdminClient(), versionId) : null;
    if (version && version.material_id !== materialId) return NextResponse.json({ error: "Material version not found." }, { status: 404 });
    return NextResponse.json({ ok: true, material: { id: material.data.id, title: material.data.title, status: material.data.status }, version: version ? { id: version.id, status: version.status, attemptCount: version.processing_attempts, failureReason: version.failure_reason, createdAt: version.created_at, updatedAt: version.updated_at } : null });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Could not load material status." }, { status: 500 });
  }
}
