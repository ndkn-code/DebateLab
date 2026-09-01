import "server-only";

import {
  listClassAnnouncements,
  listClassResources,
  listClassVocabulary,
} from "@/app/actions/class-lms";
import { loadIeltsClassGradebook } from "@/app/actions/ielts/teacher-review";
import type { IeltsTeacherWorkbenchData } from "@/components/admin/classes/IeltsTeacherWorkbench";
import { requireClassManager } from "@/lib/api/class-manager-access";
import {
  resolveTeacherWorkspaceClassFeature,
  TEACHER_WORKSPACE_COMPATIBLE_FEATURE_KEYS,
} from "@/lib/api/class-lms/teacher-workspace-capability";
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
    .select("club_id, class_id, feature_key, enabled")
    .eq("club_id", clubId)
    .in("feature_key", [...TEACHER_WORKSPACE_COMPATIBLE_FEATURE_KEYS]);
  if (flagError) return { ...empty, clubId, contentError: flagError.message };
  const enabled = resolveTeacherWorkspaceClassFeature({
    flags: flags ?? [],
    organizationId: clubId,
    classId,
    programType: "ielts",
  });
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
