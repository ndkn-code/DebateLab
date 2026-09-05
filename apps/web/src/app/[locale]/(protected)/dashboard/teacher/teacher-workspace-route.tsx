import { TeacherWorkspaceScreen } from "@/components/teacher-workspace/TeacherWorkspaceScreen";
import {
  isTeacherCalendarView,
  type TeacherCalendarStatus,
} from "@/lib/api/class-lms/teacher-calendar-model";
import { loadTeacherWorkspacePresentation } from "@/lib/teacher-workspace/server-presentation";
import type { TeacherWorkspaceSurface } from "@/lib/teacher-workspace/presentation";

const CALENDAR_STATUSES = new Set<TeacherCalendarStatus>([
  "scheduled",
  "completed",
  "cancelled",
  "archived",
]);

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export async function TeacherWorkspaceRoute({
  params,
  searchParams,
  surface,
  classId,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  surface: TeacherWorkspaceSurface;
  classId?: string;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const viewInput = first(query.view);
  const statusInput = first(query.status);
  const data = await loadTeacherWorkspacePresentation({
    locale,
    surface,
    view: isTeacherCalendarView(viewInput) ? viewInput : undefined,
    anchorDate: first(query.date),
    classId: classId ?? first(query.classId),
    programType: first(query.program),
    status:
      statusInput && CALENDAR_STATUSES.has(statusInput as TeacherCalendarStatus)
        ? (statusInput as TeacherCalendarStatus)
        : undefined,
    demo: first(query.demo),
    eventId: first(query.eventId),
    tab: first(query.tab),
  });
  return <TeacherWorkspaceScreen data={data} classId={classId} />;
}
