"use server";

import { createClient } from "@/lib/supabase/server";
import {
  materialFinalizeSchema,
  materialIngestSchema,
  materialRetrySchema,
} from "@/lib/api/class-lms/material-pipeline/contracts";
import {
  createMaterialIngest,
  finalizeMaterialIngest,
} from "@/lib/api/class-lms/material-pipeline/service";
import { getVersion } from "@/lib/api/class-lms/material-pipeline/repository";
import { enqueueMaterialProcessing } from "@/lib/queues/lms-materials";
import {
  requireClassManager,
  requireClubOwner,
} from "@/lib/api/class-manager-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { SHARED_LMS_MATERIALS_V1 } from "@/lib/features";

function requireSharedMaterials() {
  if (!SHARED_LMS_MATERIALS_V1)
    throw new Error("Shared teaching materials are not enabled.");
}

async function actorFor(
  client: Awaited<ReturnType<typeof createClient>>,
  clubId: string,
  scopeClassId: string | null,
) {
  if (scopeClassId) {
    const context = await requireClassManager(client as never, scopeClassId);
    if (context.clubId !== clubId)
      throw new Error("Class does not belong to this organisation.");
    return context.userId;
  }
  return requireClubOwner(client as never, clubId);
}

export async function prepareLmsMaterialUpload(raw: unknown) {
  requireSharedMaterials();
  const client = await createClient();
  const parsed = materialIngestSchema.parse(raw);
  const actorId = await actorFor(
    client,
    parsed.clubId,
    parsed.scopeClassId ?? null,
  );
  return createMaterialIngest(client, parsed, actorId);
}

export async function finalizeLmsMaterialUpload(raw: unknown) {
  requireSharedMaterials();
  const client = await createClient();
  const parsed = materialFinalizeSchema.parse(raw);
  const before = await getVersion(createAdminClient(), parsed.ingestionId);
  if (!before) throw new Error("Material ingestion not found.");
  const result = await finalizeMaterialIngest(
    client,
    parsed.ingestionId,
    parsed.sha256,
  );
  if (result.status === "queued")
    await enqueueMaterialProcessing({
      materialId: result.material_id,
      versionId: result.id,
      idempotencyKey: result.idempotency_key,
    });
  return {
    materialId: result.material_id,
    versionId: result.id,
    status: result.status,
  };
}

export async function retryLmsMaterialConversion(raw: unknown) {
  requireSharedMaterials();
  const parsed = materialRetrySchema.parse(raw);
  const client = await createClient();
  const admin = createAdminClient();
  const version = await getVersion(admin, parsed.versionId);
  if (!version) throw new Error("Material version not found.");
  const result = await admin
    .from("lms_materials")
    .select("club_id, scope_class_id")
    .eq("id", version.material_id)
    .single();
  if (result.error || !result.data) throw new Error("Material not found.");
  const actorId = await actorFor(
    client,
    result.data.club_id,
    result.data.scope_class_id,
  );
  if (version.status !== "failed" || !version.original_path)
    throw new Error("Only retryable conversion failures can be retried.");
  const queued = await admin
    .from("lms_material_versions")
    .update({
      processing_status: "queued",
      error_code: null,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", version.id)
    .eq("processing_status", "failed")
    .not("original_path", "is", null)
    .select("*")
    .maybeSingle();
  if (queued.error) throw new Error(queued.error.message);
  if (!queued.data)
    return {
      materialId: version.material_id,
      versionId: version.id,
      status: version.status,
      replay: true,
    };
  const idempotencyKey = `lms-material:${result.data.club_id}:${actorId}:${parsed.idempotencyKey}`;
  await enqueueMaterialProcessing({
    materialId: version.material_id,
    versionId: version.id,
    idempotencyKey,
  });
  return {
    materialId: version.material_id,
    versionId: version.id,
    status: "queued" as const,
    replay: false,
  };
}
