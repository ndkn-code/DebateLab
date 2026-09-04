import { notFound } from "next/navigation";
import { ClassDetailDashboard } from "@/components/admin/classes/ClassDetailDashboard";
import { getAdminClassDetail } from "@/lib/api/admin-classes";
import {
  canManageClubRoster,
  requireClassManager,
} from "@/lib/api/class-manager-access";
import { loadAuthorizedIeltsWorkbench } from "@/lib/api/ielts/class-workbench-page";
import { ROSTER_IMPORT_V1, TEACHER_WORKSPACE_V1 } from "@/lib/features";
import { createTypedServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Class workbench" };

export default async function TeacherClassDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  if (!TEACHER_WORKSPACE_V1) notFound();
  const { classId } = await params;
  const db = await createTypedServerClient();
  const manager = await requireClassManager(db, classId);
  const data = await getAdminClassDetail(classId);
  if (!data) notFound();
  const ieltsWorkbench =
    data.classInfo.programType === "ielts"
      ? await loadAuthorizedIeltsWorkbench(classId)
      : undefined;
  // Same authorization shape as the other two routes, so it threads the same
  // way — `requireClassManager` to reach the page, `canManageClubRoster` to
  // decide whether the import control is real for this user.
  const canImportRoster =
    ROSTER_IMPORT_V1 && (await canManageClubRoster(db, manager.clubId));
  return (
    <ClassDetailDashboard
      data={data}
      ieltsWorkbench={ieltsWorkbench}
      rosterImportEnabled={canImportRoster}
      clubId={manager.clubId}
    />
  );
}
