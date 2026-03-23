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

  return (
    <CourseSettings
      course={course}
      modules={modules ?? []}
      initialStudents={students}
    />
  );
}
