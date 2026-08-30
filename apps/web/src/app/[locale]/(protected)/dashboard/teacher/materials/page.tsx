import { notFound } from "next/navigation";
import { TeacherMaterialLibrary } from "@/components/lms/TeacherMaterialLibrary";
import type {
  MaterialPlacementTarget,
  TeacherMaterialSummary,
} from "@/components/materials/material-ui-model";
import { loadTeacherSharedMaterials } from "@/app/actions/shared-lms-materials";
import {
  materialDocumentV1Schema,
  type MaterialProcessingStatus,
} from "@/lib/api/class-lms/material-contracts";
import { loadTeacherLmsWeek } from "@/lib/api/class-lms/teacher-weekly-repository";
import { SHARED_LMS_MATERIALS_V1 } from "@/lib/features";
import { createTypedServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Material library" };

function normalizeProcessingStatus(value: string): MaterialProcessingStatus {
  if (value === "awaiting_upload") return "uploading";
  if (value === "processing") return "converting";
  if (value === "completed") return "ready";
  if (
    [
      "uploading",
      "queued",
      "scanning",
      "converting",
      "ready",
      "rejected",
      "failed",
    ].includes(value)
  ) {
    return value as MaterialProcessingStatus;
  }
  return "failed";
}

export default async function TeacherMaterialsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  if (!SHARED_LMS_MATERIALS_V1) notFound();
  const [{ locale }, week] = await Promise.all([
    params,
    loadTeacherLmsWeek({}),
  ]);
  const targets: MaterialPlacementTarget[] = [
    ...week.classes.map((item) => ({
      type: "class" as const,
      id: item.id,
      label: item.title,
      detail: item.programType,
    })),
    ...week.occurrences.map((item) => ({
      type: "occurrence" as const,
      id: item.id,
      label: item.title,
      detail: item.classTitle,
    })),
  ];
  const scopeClassId = week.classes[0]?.id;
  let clubId: string | undefined;
  if (scopeClassId) {
    const db = await createTypedServerClient();
    const { data } = await db
      .from("classes")
      .select("club_id")
      .eq("id", scopeClassId)
      .maybeSingle();
    clubId = data?.club_id ?? undefined;
  }

  let materials: TeacherMaterialSummary[] = [];
  let loadFailed = false;
  try {
    const page = await loadTeacherSharedMaterials({ limit: 100 });
    materials = page.rows.map((item) => ({
      materialId: item.id,
      versionId: item.versionId,
      title: item.title,
      description: item.description,
      sourceFileName: null,
      mimeType: null,
      sizeBytes: null,
      processingStatus: normalizeProcessingStatus(item.processingStatus),
      contentReviewStatus: item.contentReviewStatus,
      rightsBasis: null,
      rightsApproved: item.rightsApproved,
      updatedAt: item.updatedAt,
      preview: null,
      document: materialDocumentV1Schema.safeParse(item.nativeDocument).success
        ? materialDocumentV1Schema.parse(item.nativeDocument)
        : null,
      renditions: [],
      placements: item.placements.map((placement) => ({
        id: placement.id,
        targetType: placement.targetType,
        targetId: placement.targetId,
        targetLabel:
          targets.find(
            (target) =>
              target.type === placement.targetType &&
              target.id === placement.targetId,
          )?.label ?? placement.targetType,
        status: placement.status,
        releaseAt: placement.releaseAt,
        expiresAt: placement.expiresAt,
        required: placement.required,
        audienceCount: placement.audienceCount,
        rules: placement.rules.map((rule) => rule.kind),
      })),
    }));
  } catch {
    loadFailed = true;
  }

  return (
    <TeacherMaterialLibrary
      locale={locale}
      materials={materials}
      targets={targets}
      learnerPreviews={[]}
      loadFailed={loadFailed}
      clubId={clubId}
      scopeClassId={scopeClassId}
    />
  );
}
