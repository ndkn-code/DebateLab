import "server-only";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import { createTypedServerClient } from "@/lib/supabase/server";
import { requireClassManager } from "@/lib/api/class-manager-access";
import { SHARED_LMS_MATERIALS_V1 } from "@/lib/features";
import { listManagerMaterials } from "./materials-repository";
import {
  placeTeacherMaterial,
  publishTeacherMaterial,
} from "./teacher-operation-repository";
import { publishReusablePlacement } from "@/lib/teacher-workspace/material-reuse-model";

async function destination(classId: string) {
  if (!SHARED_LMS_MATERIALS_V1) throw new Error("MATERIALS_DISABLED");
  z.string().uuid().parse(classId);
  const session = await createTypedServerClient();
  const manager = await requireClassManager(session, classId);
  const db = session as unknown as SupabaseClient;
  const result = await db
    .from("classes")
    .select("program_type")
    .eq("id", classId)
    .single();
  if (!manager.clubId || result.error || !result.data)
    throw new Error("FORBIDDEN");
  return { db, clubId: manager.clubId, program: result.data.program_type };
}

export async function readReusableClassMaterials(
  classId: string,
  cursor?: string | null,
) {
  const { clubId, program } = await destination(classId);
  if (cursor) z.string().max(512).parse(cursor);
  // The existing manager RPC is the authority for private resource access.
  const page = await listManagerMaterials({ limit: 100, cursor });
  if (!page.rows.length) return page;
  // Material tables deliberately deny direct authenticated reads. Only inspect IDs
  // already authorized by the manager RPC; storage paths never leave this adapter.
  const admin = createTypedAdminClient() as unknown as SupabaseClient;
  const metadata = await admin
    .from("lms_materials")
    .select("id")
    .in(
      "id",
      page.rows.map((row) => row.id),
    )
    .eq("club_id", clubId)
    .eq("program_type", program);
  if (metadata.error) throw new Error(metadata.error.message);
  const allowed = new Set((metadata.data ?? []).map((row) => row.id));
  const ready = await admin
    .from("lms_material_renditions")
    .select("version_id")
    .in(
      "version_id",
      page.rows.map((row) => row.versionId),
    )
    .neq("rendition_kind", "original")
    .eq("bucket_id", "lms-material-previews")
    .eq("processing_status", "ready");
  if (ready.error) throw new Error(ready.error.message);
  const previews = new Set((ready.data ?? []).map((row) => row.version_id));
  return {
    ...page,
    rows: page.rows.filter(
      (row) =>
        allowed.has(row.id) &&
        previews.has(row.versionId) &&
        row.processingStatus === "ready" &&
        row.rightsApproved &&
        row.contentReviewStatus === "approved",
    ),
  };
}

export async function reuseClassMaterial(input: {
  classId: string;
  materialId: string;
  versionId: string;
  idempotencyKey: string;
}) {
  z.object({
    classId: z.string().uuid(),
    materialId: z.string().uuid(),
    versionId: z.string().uuid(),
    idempotencyKey: z.string().min(8).max(160),
  })
    .strict()
    .parse(input);
  const { clubId, program } = await destination(input.classId);
  // RLS plus the manager RPC excludes learner-readable private resources.
  let cursor: string | null = null;
  let eligible = false;
  do {
    const page = await readReusableClassMaterials(input.classId, cursor);
    eligible = page.rows.some(
      (row) => row.id === input.materialId && row.versionId === input.versionId,
    );
    cursor = page.nextCursor;
  } while (!eligible && cursor);
  if (!eligible) throw new Error("MATERIAL_NOT_ELIGIBLE");
  const admin = createTypedAdminClient() as unknown as SupabaseClient;
  const metadata = await admin
    .from("lms_materials")
    .select("id")
    .eq("id", input.materialId)
    .eq("club_id", clubId)
    .eq("program_type", program)
    .single();
  if (metadata.error || !metadata.data) throw new Error("FORBIDDEN");
  return publishReusablePlacement(input.versionId, {
    read: async () => {
      const result = await admin
        .from("lms_material_placements")
        .select("id,version_id,status,audience_mode,release_at,expires_at")
        .eq("material_id", input.materialId)
        .eq("target_type", "class")
        .eq("class_id", input.classId)
        .maybeSingle();
      if (result.error) throw new Error(result.error.message);
      if (!result.data) return null;
      const rules = await admin
        .from("lms_material_unlock_rules")
        .select("id", { count: "exact", head: true })
        .eq("placement_id", result.data.id);
      if (rules.error) throw new Error(rules.error.message);
      return {
        id: result.data.id,
        versionId: result.data.version_id,
        status: result.data.status,
        audienceMode: result.data.audience_mode,
        releaseAt: result.data.release_at,
        expiresAt: result.data.expires_at,
        ruleCount: rules.count ?? 0,
      };
    },
    place: async () => {
      await placeTeacherMaterial({
        materialId: input.materialId,
        versionId: input.versionId,
        classId: input.classId,
        targetType: "class",
        status: "draft",
        audienceUserIds: [],
        rules: [],
        idempotencyKey: `${input.idempotencyKey}:place`,
      });
    },
    publish: async (placementId) => {
      await publishTeacherMaterial({
        materialId: input.materialId,
        placementId,
        idempotencyKey: `${input.idempotencyKey}:publish`,
      });
    },
  });
}
