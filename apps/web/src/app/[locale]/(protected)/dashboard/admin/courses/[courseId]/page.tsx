import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CourseEditor } from "@/components/admin/courses/CourseEditor";

export const metadata = { title: "Admin — Edit Course" };

export default async function CourseEditorPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();

  if (!course) redirect("/dashboard/admin/courses");

  const { data: modules } = await supabase
    .from("course_modules")
    .select("*")
    .eq("course_id", courseId)
    .order("sort_order");

  // Fetch activities for each module
  const modulesWithActivities = await Promise.all(
    (modules ?? []).map(async (mod) => {
      const { data: activities } = await supabase
        .from("activities")
        .select("*")
        .eq("module_id", mod.id)
        .order("order_index");
      return { ...mod, activities: activities ?? [] };
    })
  );

  return (
    <CourseEditor
      course={{ ...course, modules: modulesWithActivities }}
    />
  );
}
