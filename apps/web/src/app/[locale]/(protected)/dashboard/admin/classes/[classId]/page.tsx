import { notFound } from "next/navigation";
import { ClassDetailDashboard } from "@/components/admin/classes/ClassDetailDashboard";
import { getAdminClassDetail } from "@/lib/api/admin-classes";
import { requireClassManager } from "@/lib/api/class-manager-access";
import { loadAuthorizedIeltsWorkbench } from "@/lib/api/ielts/class-workbench-page";
import { ROSTER_IMPORT_V1 } from "@/lib/features";
import { createTypedServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin - Class Detail" };

export default async function AdminClassDetailPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const data = await getAdminClassDetail(classId);
  if (!data) notFound();

  // `ROSTER_IMPORT_V1` is server-evaluated and the dashboard is a client
  // component, so the flag is read here. The club id comes from the same
  // manager context the roster actions authorize against — `classInfo` does not
  // carry it.
  const db = await createTypedServerClient();
  const manager = await requireClassManager(db, classId);

  const ieltsWorkbench =
    data.classInfo.programType === "ielts"
      ? await loadAuthorizedIeltsWorkbench(classId)
      : undefined;

  return (
    <ClassDetailDashboard
      data={data}
      ieltsWorkbench={ieltsWorkbench}
      rosterImportEnabled={ROSTER_IMPORT_V1}
      clubId={manager.clubId}
    />
  );
}
