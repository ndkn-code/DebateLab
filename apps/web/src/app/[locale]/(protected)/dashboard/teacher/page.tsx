import { TeacherWorkspaceRoute } from "./teacher-workspace-route";

export const dynamic = "force-dynamic";
export const metadata = { title: "Teacher workspace — Thinkfy" };

export default function TeacherWorkspacePage({
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
      surface="calendar"
    />
  );
}
