import { createClient } from "@/lib/supabase/server";
import { CourseTable } from "@/components/admin/courses/CourseTable";
import type { AdminCourse } from "@/lib/types/admin";

export const metadata = { title: "Admin — Courses" };

export default async function CoursesPage() {
  const supabase = await createClient();

  const { data: courseRows, error: courseRowsError } = await supabase
    .from("admin_course_list_rows")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: fallbackCourses } = courseRowsError
    ? await supabase
        .from("courses")
        .select("*")
        .order("created_at", { ascending: false })
    : { data: null };

  const formatted = (courseRowsError ? fallbackCourses ?? [] : courseRows ?? []) as unknown as AdminCourse[];

  return <CourseTable initialCourses={formatted} />;
}
