import { notFound } from "next/navigation";
import { z } from "zod";
import { Link } from "@/i18n/navigation";
import { PageContainer } from "@/components/shared/product-layout";
import { LearnerMaterials } from "@/components/materials/LearnerMaterials";
import {
  fileKind,
  type LearnerMaterialProjection,
} from "@/components/materials/material-ui-model";
import { loadMySharedMaterialsWeek } from "@/app/actions/shared-lms-materials";
import { materialDocumentV1Schema } from "@/lib/api/class-lms/material-contracts";
import { SHARED_LMS_MATERIALS_V1 } from "@/lib/features";
import { createTypedServerClient } from "@/lib/supabase/server";
import { isIeltsAccessible } from "@/lib/ielts/access";

/** Class-context learner readback; the existing RPC enforces audience and unlock rules. */
export default async function ClassMaterialsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ classId?: string }>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (
    !SHARED_LMS_MATERIALS_V1 ||
    !z.string().uuid().safeParse(query.classId).success
  )
    notFound();
  const classId = query.classId as string;
  const session = await createTypedServerClient();
  const { data: classRow, error } = await session
    .from("classes")
    .select("title,program_type")
    .eq("id", classId)
    .single();
  if (
    error ||
    !classRow ||
    (classRow.program_type === "ielts" && !(await isIeltsAccessible()))
  )
    notFound();
  const vi = locale === "vi";
  const today = new Date().toISOString().slice(0, 10);
  let materials: LearnerMaterialProjection[] = [];
  let failed = false;
  try {
    const rows = await loadMySharedMaterialsWeek({
      classId,
      from: today,
      to: today,
    });
    materials = rows.map((row) => {
      const preview = row.previews[0] ?? null;
      const document =
        row.accessState === "available"
          ? materialDocumentV1Schema.safeParse(row.nativeDocument)
          : null;
      return {
        materialId: row.id,
        placementId: row.placementId,
        versionId: row.versionId,
        title: row.title,
        description: row.description,
        mediaKind: fileKind(
          preview?.mimeType ?? row.previewMimeType ?? "application/pdf",
        ),
        mimeType: preview?.mimeType ?? row.previewMimeType ?? "application/pdf",
        processingStatus: row.processingStatus === "ready" ? "ready" : "failed",
        placementStatus: "published",
        accessState: row.accessState,
        lockReasons: row.lockReasons,
        required: row.required,
        lessonTitle: null,
        availableAt: row.releaseAt,
        preview,
        document: document?.success ? document.data : null,
        renditions: row.previews.map((item) => ({
          renditionId: item.renditionId,
          preview: item,
          transcript: null,
        })),
      };
    });
  } catch {
    failed = true;
  }
  return (
    <PageContainer size="wide">
      <header className="mb-5">
        <h1 className="type-heading-lg text-on-surface">{classRow.title}</h1>
        <p className="mt-1 type-body text-on-surface-variant">
          {vi ? "Tài liệu lớp học" : "Class materials"}
        </p>
      </header>
      {failed ? (
        <div
          role="alert"
          className="rounded-control border border-outline-variant bg-surface p-4"
        >
          <p className="type-body text-on-surface">
            {vi ? "Chưa tải được tài liệu." : "Could not load materials."}
          </p>
          <Link
            href={`/dashboard/materials?classId=${classId}`}
            className="mt-2 inline-block type-label text-primary"
          >
            {vi ? "Thử lại" : "Retry"}
          </Link>
        </div>
      ) : (
        <LearnerMaterials materials={materials} locale={locale} />
      )}
    </PageContainer>
  );
}
