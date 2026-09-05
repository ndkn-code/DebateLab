import "server-only";
import { createTypedServerClient } from "@/lib/supabase/server";
import {
  requireClassManager,
  requireClubOwner,
} from "@/lib/api/class-manager-access";
import { isIeltsAccessible } from "@/lib/ielts/access";
import { ORGANIZATIONS_V1 } from "@/lib/features";
import {
  resolveTeacherWorkspaceClassFeature,
  TEACHER_WORKSPACE_COMPATIBLE_FEATURE_KEYS,
} from "@/lib/api/class-lms/teacher-workspace-capability";
import { readPages, requireRows } from "./query-pages";
import { validTimezone } from "./reporting-period";
import type { IeltsDbClient } from "@/lib/api/ielts/client";
export class AnalyticsForbidden extends Error {}
export async function requireAnalyticsClass(
  client: IeltsDbClient,
  classId: string,
  ieltsAccessible = isIeltsAccessible,
) {
  let manager;
  try {
    manager = await requireClassManager(client, classId);
  } catch {
    throw new AnalyticsForbidden("Forbidden");
  }
  if (!manager.clubId || !(await ieltsAccessible()))
    throw new AnalyticsForbidden("Forbidden");
  const [classResult, flags] = await Promise.all([
    client
      .from("classes")
      .select("id,club_id,program_type")
      .eq("id", classId)
      .eq("club_id", manager.clubId)
      .maybeSingle(),
    readPages((from, to) =>
      client
        .from("lms_pilot_flags")
        .select("club_id,class_id,feature_key,enabled")
        .eq("club_id", manager.clubId!)
        .in("feature_key", [...TEACHER_WORKSPACE_COMPATIBLE_FEATURE_KEYS])
        .order("id")
        .range(from, to),
    ),
  ]);
  if (classResult.error) throw new Error("Class unavailable");
  if (
    !classResult.data ||
    !resolveTeacherWorkspaceClassFeature({
      flags: requireRows(flags, "pilot flags"),
      organizationId: manager.clubId,
      classId,
      programType:
        classResult.data.program_type === "ielts" ? "ielts" : "debate",
    })
  )
    throw new AnalyticsForbidden("Forbidden");
  return manager;
}
export async function requireAnalyticsCentre(
  client: IeltsDbClient,
  clubId: string,
  organizationsEnabled = ORGANIZATIONS_V1,
) {
  if (!organizationsEnabled) throw new AnalyticsForbidden("Forbidden");
  try {
    return await requireClubOwner(client, clubId);
  } catch {
    throw new AnalyticsForbidden("Forbidden");
  }
}
export async function centreTimezone(
  client: IeltsDbClient,
  clubId: string,
): Promise<string> {
  const { data, error } = await client
    .from("clubs")
    .select("metadata")
    .eq("id", clubId)
    .maybeSingle();
  if (error || !data) throw new Error("Centre unavailable");
  const metadata = data.metadata;
  return validTimezone(
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? metadata.timezone
      : null,
  );
}
export { createTypedServerClient };
