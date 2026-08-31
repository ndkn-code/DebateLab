import { notFound } from "next/navigation";
import { ClassDetailDashboard } from "@/components/admin/classes/ClassDetailDashboard";
import type { WorkbenchTab } from "@/components/admin/classes/IeltsTeacherWorkbench";
import { getAdminClassDetail } from "@/lib/api/admin-classes";
import { requireClassManager } from "@/lib/api/class-manager-access";
import { loadAuthorizedIeltsWorkbench } from "@/lib/api/ielts/class-workbench-page";
import { createTypedServerClient } from "@/lib/supabase/server";

const WORKBENCH_TABS = new Set<WorkbenchTab>([
  "overview",
  "gradebook",
  "reviews",
  "assignments",
  "content",
  "announcements",
]);

export default async function TeacherClassWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; classId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ classId }, query] = await Promise.all([params, searchParams]);
  const db = await createTypedServerClient();
  await requireClassManager(db, classId);
  const data = await getAdminClassDetail(classId);
  if (!data) notFound();
  const ieltsWorkbench =
    data.classInfo.programType === "ielts"
      ? await loadAuthorizedIeltsWorkbench(classId)
      : undefined;
  const tabValue = Array.isArray(query.workbenchTab)
    ? query.workbenchTab[0]
    : query.workbenchTab;
  const responseId = Array.isArray(query.responseId)
    ? query.responseId[0]
    : query.responseId;
  return (
    <ClassDetailDashboard
      data={data}
      ieltsWorkbench={ieltsWorkbench}
      ieltsInitialTab={
        tabValue && WORKBENCH_TABS.has(tabValue as WorkbenchTab)
          ? (tabValue as WorkbenchTab)
          : undefined
      }
      ieltsInitialResponseId={responseId ?? null}
    />
  );
}
