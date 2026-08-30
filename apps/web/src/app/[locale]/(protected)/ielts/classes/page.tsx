import { notFound } from "next/navigation";
import { StudentLmsWeek } from "@/components/lms/StudentLmsWeek";
import type { LearnerMaterialProjection } from "@/components/materials/material-ui-model";
import { fileKind } from "@/components/materials/material-ui-model";
import { loadMySharedMaterialsWeek } from "@/app/actions/shared-lms-materials";
import { getSessionUserId } from "@/lib/api/ielts/assignment-access";
import { loadMyStudentLmsWeek } from "@/lib/api/class-lms/student-weekly-repository";
import type { StudentWeeklyOccurrence } from "@/lib/api/class-lms/student-weekly-repository";
import type { LearnerMaterialRow } from "@/lib/api/class-lms/materials-repository";
import { DEFAULT_CLASS_TIMEZONE } from "@/lib/api/admin-class-schedules-model";
import {
  addIsoDateDays,
  weekStartForTimezone,
} from "@/lib/api/class-lms/weekly-model";
import {
  SHARED_LMS_MATERIALS_V1,
  STUDENT_LMS_WORKSPACE_V1,
} from "@/lib/features";
import {
  materialDocumentV1Schema,
  type MaterialProcessingStatus,
} from "@/lib/api/class-lms/material-contracts";
import { normalizeStreakTimezone } from "@/lib/streaks/model";
import { createTypedServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "My IELTS classes" };

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
  )
    return value as MaterialProcessingStatus;
  return "failed";
}

function toLearnerProjection(
  row: LearnerMaterialRow,
  lessonTitle: string | null,
): LearnerMaterialProjection {
  const parsedDocument = materialDocumentV1Schema.safeParse(row.nativeDocument);
  const primaryPreview =
    row.previews.find((item) => item.renditionKind === row.renditionKind) ??
    row.previews[0] ??
    null;
  return {
    materialId: row.id,
    placementId: row.placementId,
    versionId: row.versionId,
    title: row.title,
    description: row.description,
    mediaKind: fileKind(
      primaryPreview?.mimeType ?? row.previewMimeType ?? "application/pdf",
    ),
    mimeType:
      primaryPreview?.mimeType ??
      row.previewMimeType ??
      "application/octet-stream",
    processingStatus: normalizeProcessingStatus(row.processingStatus),
    placementStatus: "published",
    accessState: row.accessState,
    lockReasons: row.lockReasons,
    required: row.required,
    lessonTitle,
    availableAt: row.releaseAt,
    preview: primaryPreview,
    document: parsedDocument.success ? parsedDocument.data : null,
    renditions: row.previews.map((item) => ({
      renditionId: item.renditionId,
      preview: item,
      transcript: null,
    })),
  };
}

async function loadMaterialsByOccurrence({
  startDate,
  endDate,
  occurrences,
}: {
  startDate: string;
  endDate: string;
  occurrences: StudentWeeklyOccurrence[];
}): Promise<Record<string, LearnerMaterialProjection[]>> {
  try {
    const rows = await loadMySharedMaterialsWeek({
      from: startDate,
      to: endDate,
    });
    const grouped: Record<string, LearnerMaterialProjection[]> = {};
    for (const row of rows) {
      if (!row.occurrenceId) continue;
      const material = toLearnerProjection(
        row,
        occurrences.find((item) => item.id === row.occurrenceId)?.lessonTitle ??
          null,
      );
      (grouped[row.occurrenceId] ??= []).push(material);
    }
    return grouped;
  } catch (error) {
    console.error("load learner materials for IELTS week failed", error);
    return {};
  }
}

export default async function IeltsClassesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ weekStart?: string }>;
}) {
  if (!STUDENT_LMS_WORKSPACE_V1) notFound();
  const [{ locale }, filters] = await Promise.all([params, searchParams]);
  const db = await createTypedServerClient();
  const userId = await getSessionUserId(db);
  const { data: plan, error: planError } = await db
    .from("ielts_study_plans")
    .select("timezone")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (planError)
    throw new Error(`load IELTS class timezone: ${planError.message}`);
  const timezone = normalizeStreakTimezone(
    plan?.timezone ?? DEFAULT_CLASS_TIMEZONE,
  );
  const startDate = weekStartForTimezone(filters.weekStart, timezone);
  const endDate = addIsoDateDays(startDate, 6);
  const data = await loadMyStudentLmsWeek({
    startDate,
    endDate,
  });
  const materialsByOccurrence = SHARED_LMS_MATERIALS_V1
    ? await loadMaterialsByOccurrence({
        startDate,
        endDate,
        occurrences: data.occurrences,
      })
    : {};

  return (
    <StudentLmsWeek
      data={data}
      locale={locale}
      timezone={timezone}
      materialsByOccurrence={materialsByOccurrence}
    />
  );
}
