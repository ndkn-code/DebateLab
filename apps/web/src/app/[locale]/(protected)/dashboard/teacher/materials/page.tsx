import { TeacherWorkspaceRoute } from "../teacher-workspace-route";

export default function TeacherMaterialsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <TeacherWorkspaceRoute
      params={params}
      searchParams={searchParams}
      surface="materials"
    />
  );
}
