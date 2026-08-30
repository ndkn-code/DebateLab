import "server-only";

import {
  listClassAnnouncements,
  listClassResources,
  listClassVocabulary,
} from "@/app/actions/class-lms";
import { loadIeltsClassGradebook } from "@/app/actions/ielts/teacher-review";
import type { IeltsTeacherWorkbenchData } from "@/components/admin/classes/IeltsTeacherWorkbench";
import { requireClassManager } from "@/lib/api/class-manager-access";
import { LMS_PILOT_FEATURE_KEY } from "@/lib/api/class-lms/model";
import { createTypedServerClient } from "@/lib/supabase/server";

function errorMessage(result: PromiseRejectedResult) {
  return result.reason instanceof Error
    ? result.reason.message
    : "Unable to load IELTS workbench data.";
}

/** Shared loader for both platform admins and the non-admin teacher route. */
export async function loadAuthorizedIeltsWorkbench(
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
  const db = await createTypedServerClient();
  const manager = await requireClassManager(db, classId);
  if (!manager.clubId) {
    return { ...empty, contentError: "This class is not linked to an organisation." };
  }
  const clubId = manager.clubId;
  const { data: flags, error: flagError } = await db
    .from("lms_pilot_flags")
    .select("class_id, enabled")
    .eq("club_id", clubId)
    .eq("feature_key", LMS_PILOT_FEATURE_KEY);
  if (flagError) return { ...empty, clubId, contentError: flagError.message };
  const specific = (flags ?? []).find((flag) => flag.class_id === classId);
  const organisation = (flags ?? []).find((flag) => flag.class_id === null);
  const enabled = Boolean((specific ?? organisation)?.enabled);
  if (!enabled) return { ...empty, clubId };

  const [gradebook, announcements, resources, vocabulary] =
    await Promise.allSettled([
      loadIeltsClassGradebook({ classId, clubId, limit: 100 }),
      listClassAnnouncements(classId),
      listClassResources(classId),
      listClassVocabulary(classId),
    ]);
  const contentFailures = [announcements, resources, vocabulary]
    .filter((result): result is PromiseRejectedResult => result.status === "rejected")
    .map(errorMessage);
  return {
    enabled: true,
    clubId,
    gradebook: gradebook.status === "fulfilled" ? gradebook.value : null,
    announcements: announcements.status === "fulfilled" ? announcements.value : [],
    resources: resources.status === "fulfilled" ? resources.value : [],
    vocabulary: vocabulary.status === "fulfilled" ? vocabulary.value : [],
    gradebookError: gradebook.status === "rejected" ? errorMessage(gradebook) : null,
    contentError: contentFailures.length ? contentFailures.join(" ") : null,
  };
}
