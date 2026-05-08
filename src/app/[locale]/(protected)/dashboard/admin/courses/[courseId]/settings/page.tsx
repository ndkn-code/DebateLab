import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CourseSettings } from "@/components/admin/courses/CourseSettings";

export const metadata = { title: "Admin — Course Settings" };

export default async function CourseSettingsPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, title, visibility")
    .eq("id", courseId)
    .single();

  if (!course) redirect("/dashboard/admin/courses");

  const { data: modules } = await supabase
    .from("course_modules")
    .select("id, title, sort_order, access_level")
    .eq("course_id", courseId)
    .order("sort_order");

  // Get assigned students
  const { data: rules } = await supabase
    .from("course_access_rules")
    .select("target_id")
    .eq("course_id", courseId)
    .eq("rule_type", "individual_user");

  let students: { id: string; display_name: string; avatar_url: string | null; email: string | null }[] = [];
  if (rules && rules.length > 0) {
    const ids = rules.map((r) => r.target_id);
    const { data } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url, email")
      .in("id", ids);
    students = data ?? [];
  }

  const { data: assignments } = await supabase
    .from("class_course_assignments")
    .select("class_id")
    .eq("course_id", courseId);

  let assignedClasses: {
    id: string;
    code: string;
    title: string;
    grade_level: string | null;
    status: string;
    student_count?: number | null;
  }[] = [];

  if (assignments && assignments.length > 0) {
    const ids = assignments.map((assignment) => assignment.class_id);
    const { data } = await supabase
      .from("admin_class_list_rows")
      .select("id, code, title, grade_level, status, student_count")
      .in("id", ids);
    assignedClasses = data ?? [];
  }

  return (
    <CourseSettings
      course={course}
      modules={modules ?? []}
      initialStudents={students}
      initialClasses={assignedClasses}
    />
  );
}
