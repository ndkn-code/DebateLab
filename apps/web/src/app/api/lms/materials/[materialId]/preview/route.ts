import { NextResponse, type NextRequest } from "next/server";
import { requireRequestAuth } from "@/lib/api/request-auth";
import { buildAuthorizedMaterialPreviewDescriptor } from "@/lib/api/class-lms/material-pipeline/service";
import { SHARED_LMS_MATERIALS_V1 } from "@/lib/features";

export const dynamic = "force-dynamic";

/** Returns a short-lived signed URL only after the canonical access RPC passes. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ materialId: string }> },
) {
  if (!SHARED_LMS_MATERIALS_V1)
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return auth.errorResponse;
  try {
    const { materialId } = await params;
    const placementId = request.nextUrl.searchParams.get("placementId");
    const versionId = request.nextUrl.searchParams.get("versionId");
    const renditionId = request.nextUrl.searchParams.get("renditionId");
    if (!placementId || !versionId || !renditionId)
      return NextResponse.json(
        { error: "placementId, versionId, and renditionId are required." },
        { status: 400 },
      );
    const access = await auth.supabase.rpc("can_access_lms_material_preview", {
      p_placement_id: placementId,
      p_version_id: versionId,
      p_rendition_id: renditionId,
    });
    if (access.error) throw new Error(access.error.message);
    if (access.data !== true)
      return NextResponse.json(
        { error: "Preview not available." },
        { status: 404 },
      );
    const descriptor = await buildAuthorizedMaterialPreviewDescriptor({
      materialId,
      placementId,
      versionId,
      renditionId,
    });
    if (!descriptor)
      return NextResponse.json(
        { error: "Preview is not available yet." },
        { status: 404 },
      );
    return NextResponse.json({ ok: true, preview: descriptor });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Could not load material preview.",
      },
      { status: 500 },
    );
  }
}
