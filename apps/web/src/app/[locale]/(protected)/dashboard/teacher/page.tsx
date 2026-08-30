import { notFound } from "next/navigation";
import { TeacherWeekCalendar } from "@/components/lms/TeacherWeekCalendar";
import { loadTeacherLmsWeek } from "@/lib/api/class-lms/teacher-weekly-repository";
import { TEACHER_WORKSPACE_V1 } from "@/lib/features";

export const dynamic = "force-dynamic";
export const metadata = { title: "Teacher workspace" };

export default async function TeacherWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{
    weekStart?: string;
    classId?: string;
    program?: string;
    view?: string;
  }>;
}) {
  if (!TEACHER_WORKSPACE_V1) notFound();
  const [{ locale }, filters] = await Promise.all([params, searchParams]);
  const data = await loadTeacherLmsWeek({
    weekStart: filters.weekStart,
    classId: filters.classId || undefined,
    programType: filters.program || undefined,
  });

  return (
    <TeacherWeekCalendar
      data={data}
      locale={locale}
      selectedClassId={filters.classId || undefined}
      selectedProgram={filters.program || undefined}
      showClasses={filters.view === "classes"}
    />
  );
}
