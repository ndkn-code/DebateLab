import { notFound } from "next/navigation";
import { ClassDetailDashboard } from "@/components/admin/classes/ClassDetailDashboard";
import { getAdminClassDetail } from "@/lib/api/admin-classes";
import { requireClassManager } from "@/lib/api/class-manager-access";
import { loadAuthorizedIeltsWorkbench } from "@/lib/api/ielts/class-workbench-page";
import { TEACHER_WORKSPACE_V1 } from "@/lib/features";
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
  await requireClassManager(db, classId);
  const data = await getAdminClassDetail(classId);
  if (!data) notFound();
  const ieltsWorkbench =
    data.classInfo.programType === "ielts"
      ? await loadAuthorizedIeltsWorkbench(classId)
      : undefined;
  return <ClassDetailDashboard data={data} ieltsWorkbench={ieltsWorkbench} />;
}
