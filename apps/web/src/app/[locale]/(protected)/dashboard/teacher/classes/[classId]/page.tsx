import { TeacherWorkspaceRoute } from "../../teacher-workspace-route";

export default async function TeacherClassWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; classId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolved = await params;
  return (
    <TeacherWorkspaceRoute
      params={Promise.resolve({ locale: resolved.locale })}
      searchParams={searchParams}
      surface="class-detail"
      classId={resolved.classId}
    />
  );
}
