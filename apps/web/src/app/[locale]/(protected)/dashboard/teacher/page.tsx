import { notFound } from "next/navigation";
import { TeacherWeekCalendar } from "@/components/lms/TeacherWeekCalendar";
import { loadTeacherLmsWeek } from "@/lib/api/class-lms/teacher-weekly-repository";
import { requirePlatformAdmin } from "@/lib/api/class-manager-access";
import { TEACHER_WORKSPACE_V1 } from "@/lib/features";
import { createTypedServerClient } from "@/lib/supabase/server";

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
  // Keep the teacher workspace fail-closed for its general rollout while still
  // allowing platform admins to preview the exact teacher experience. The
  // loader below remains the source of class-scoped authorization and data.
  if (!TEACHER_WORKSPACE_V1) {
    const supabase = await createTypedServerClient();
    try {
      await requirePlatformAdmin(supabase);
    } catch {
      notFound();
    }
  }
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
