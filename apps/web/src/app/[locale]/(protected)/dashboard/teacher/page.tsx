import { notFound } from "next/navigation";
import { TeacherWeekCalendar } from "@/components/lms/TeacherWeekCalendar";
import { loadTeacherLmsWeek } from "@/lib/api/class-lms/teacher-weekly-repository";
import type { TeacherWeekView } from "@/lib/api/class-lms/teacher-weekly-repository";
import { requirePlatformAdmin } from "@/lib/api/class-manager-access";
import { TEACHER_WORKSPACE_V1 } from "@/lib/features";
import { createTypedServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Teacher workspace" };

function fallbackWeekStart(value?: string): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const today = new Date();
  const mondayOffset = (today.getUTCDay() + 6) % 7;
  today.setUTCDate(today.getUTCDate() - mondayOffset);
  return today.toISOString().slice(0, 10);
}

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
  const supabase = await createTypedServerClient();
  let isAdminPreview = false;
  try {
    await requirePlatformAdmin(supabase);
    isAdminPreview = true;
  } catch {
    if (!TEACHER_WORKSPACE_V1) notFound();
  }
  const [{ locale }, filters] = await Promise.all([params, searchParams]);
  let data: TeacherWeekView;
  try {
    data = await loadTeacherLmsWeek({
      weekStart: filters.weekStart,
      classId: filters.classId || undefined,
      programType: filters.program || undefined,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (!isAdminPreview || !message.includes("lms_lesson_occurrences")) {
      throw error;
    }
    const startDate = fallbackWeekStart(filters.weekStart);
    const end = new Date(`${startDate}T00:00:00Z`);
    end.setUTCDate(end.getUTCDate() + 6);
    console.warn("Teacher preview schedule is not available in this environment", {
      error,
    });
    data = {
      startDate,
      endDate: end.toISOString().slice(0, 10),
      timezone: "UTC",
      occurrences: [],
      classes: [],
    };
  }

  return (
    <TeacherWeekCalendar
      data={data}
      locale={locale}
      selectedClassId={filters.classId || undefined}
      selectedProgram={filters.program || undefined}
      showClasses={filters.view === "classes"}
      isAdminPreview={isAdminPreview}
    />
  );
}
