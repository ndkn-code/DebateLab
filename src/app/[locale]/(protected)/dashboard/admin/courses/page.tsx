import { createClient } from "@/lib/supabase/server";
import { CourseTable } from "@/components/admin/courses/CourseTable";
import type { AdminCourse } from "@/lib/types/admin";

export const metadata = { title: "Admin — Courses" };

export default async function CoursesPage() {
  const supabase = await createClient();

  const { data: courses } = await supabase
    .from("courses")
    .select("*, enrollments(count)")
    .order("created_at", { ascending: false });

  const formatted = (courses ?? []).map((c: Record<string, unknown>) => ({
    ...c,
    enrollment_count: Array.isArray(c.enrollments) && c.enrollments[0]
      ? (c.enrollments[0] as Record<string, number>).count ?? 0
      : 0,
  })) as unknown as AdminCourse[];

  return <CourseTable initialCourses={formatted} />;
}
