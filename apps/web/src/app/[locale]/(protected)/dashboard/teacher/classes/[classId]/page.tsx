import { TeacherWorkspaceRoute } from "../../teacher-workspace-route";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/components/shared/product-layout";
import { notFound } from "next/navigation";
import { ClassDetailDashboard } from "@/components/admin/classes/ClassDetailDashboard";
import type { WorkbenchTab } from "@/components/admin/classes/IeltsTeacherWorkbench";
import { getAdminClassDetail } from "@/lib/api/admin-classes";
import {
  canManageClubRoster,
  requireClassManager,
} from "@/lib/api/class-manager-access";
import { loadAuthorizedIeltsWorkbench } from "@/lib/api/ielts/class-workbench-page";
import { ROSTER_IMPORT_V1 } from "@/lib/features";
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
  const [{ classId, locale }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const db = await createTypedServerClient();
  const manager = await requireClassManager(db, classId);
  const classTab = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  if (classTab === "gradebook" || classTab === "materials") {
    return (
      <TeacherWorkspaceRoute
        params={Promise.resolve({ locale })}
        searchParams={Promise.resolve(query)}
        surface="class-detail"
        classId={classId}
      />
    );
  }
  const data = await getAdminClassDetail(classId);
  if (!data) notFound();
  // This is the route a centre's own owner/head teacher actually works in — the
  // /dashboard/admin/* one is not where a real term is run. Gated on the same
  // predicate `requireClubOwner` enforces, so a plain class teacher sees no
  // control rather than a button that throws.
  const canImportRoster =
    ROSTER_IMPORT_V1 && (await canManageClubRoster(db, manager.clubId));
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
    <>
      <PageContainer size="data" className="pb-0">
        <nav
          aria-label={locale === "vi" ? "Công cụ lớp học" : "Class tools"}
          className="flex flex-wrap gap-2"
        >
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/dashboard/teacher/classes/${classId}?tab=gradebook`} />}
          >
            {locale === "vi" ? "Chấm bài và sổ điểm" : "Grade submissions"}
          </Button>
          <Button
            variant="outline"
            nativeButton={false}
            render={<Link href={`/dashboard/teacher/classes/${classId}?tab=materials`} />}
          >
            {locale === "vi" ? "Tài liệu lớp học" : "Class materials"}
          </Button>
        </nav>
      </PageContainer>
      <ClassDetailDashboard
        classesHref="/dashboard/teacher/classes"
        data={data}
        ieltsWorkbench={ieltsWorkbench}
        ieltsInitialTab={
          tabValue && WORKBENCH_TABS.has(tabValue as WorkbenchTab)
            ? (tabValue as WorkbenchTab)
            : undefined
        }
        ieltsInitialResponseId={responseId ?? null}
        rosterImportEnabled={canImportRoster}
        clubId={manager.clubId}
      />
    </>
  );
}
