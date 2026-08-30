import { notFound } from "next/navigation";
import {
  listClassAnnouncements,
  listClassResources,
  listClassVocabulary,
} from "@/app/actions/class-lms";
import { loadIeltsClassGradebook } from "@/app/actions/ielts/teacher-review";
import { ClassDetailDashboard } from "@/components/admin/classes/ClassDetailDashboard";
import type { IeltsTeacherWorkbenchData } from "@/components/admin/classes/IeltsTeacherWorkbench";
import { getAdminClassDetail } from "@/lib/api/admin-classes";
import { LMS_PILOT_FEATURE_KEY } from "@/lib/api/class-lms/model";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin - Class Detail" };

function errorMessage(result: PromiseRejectedResult) {
  return result.reason instanceof Error
    ? result.reason.message
    : "Unable to load IELTS workbench data.";
}

async function loadIeltsWorkbench(
  classId: string,
): Promise<IeltsTeacherWorkbenchData> {
  const empty: IeltsTeacherWorkbenchData = {
    enabled: false,
    clubId: null,
    gradebook: null,
    announcements: [],
    resources: [],
    vocabulary: [],
    gradebookError: null,
    contentError: null,
  };

  const db = await createClient();
  const { data: classRow, error: classError } = await db
    .from("classes")
    .select("club_id")
    .eq("id", classId)
    .maybeSingle();

  if (classError || !classRow?.club_id) {
    return {
      ...empty,
      contentError:
        classError?.message ?? "This class is not linked to an organisation.",
    };
  }

  const clubId = String(classRow.club_id);
  const { data: flags, error: flagError } = await db
    .from("lms_pilot_flags")
    .select("class_id, enabled")
    .eq("club_id", clubId)
    .eq("feature_key", LMS_PILOT_FEATURE_KEY);

  if (flagError) {
    return { ...empty, clubId, contentError: flagError.message };
  }

  const specific = (flags ?? []).find(
    (flag: { class_id: string | null }) => flag.class_id === classId,
  );
  const organisation = (flags ?? []).find(
    (flag: { class_id: string | null }) => flag.class_id === null,
  );
  const enabled = Boolean((specific ?? organisation)?.enabled);
  if (!enabled) return { ...empty, clubId };

  const [
    gradebookResult,
    announcementsResult,
    resourcesResult,
    vocabularyResult,
  ] = await Promise.allSettled([
    loadIeltsClassGradebook({ classId, clubId, limit: 100 }),
    listClassAnnouncements(classId),
    listClassResources(classId),
    listClassVocabulary(classId),
  ]);

  const contentFailures = [
    announcementsResult,
    resourcesResult,
    vocabularyResult,
  ]
    .filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    )
    .map(errorMessage);

  return {
    enabled: true,
    clubId,
    gradebook:
      gradebookResult.status === "fulfilled" ? gradebookResult.value : null,
    announcements:
      announcementsResult.status === "fulfilled"
        ? announcementsResult.value
        : [],
    resources:
      resourcesResult.status === "fulfilled" ? resourcesResult.value : [],
    vocabulary:
      vocabularyResult.status === "fulfilled" ? vocabularyResult.value : [],
    gradebookError:
      gradebookResult.status === "rejected"
        ? errorMessage(gradebookResult)
        : null,
    contentError: contentFailures.length ? contentFailures.join(" ") : null,
  };
}

export default async function AdminClassDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const data = await getAdminClassDetail(classId);
  if (!data) notFound();

  const ieltsWorkbench =
    data.classInfo.programType === "ielts"
      ? await loadIeltsWorkbench(classId)
      : undefined;

  return <ClassDetailDashboard data={data} ieltsWorkbench={ieltsWorkbench} />;
}
