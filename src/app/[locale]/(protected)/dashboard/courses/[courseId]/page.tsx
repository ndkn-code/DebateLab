import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CoursePlayerView } from "@/components/activities/CoursePlayerView";

export default async function CourseDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { courseId } = await params;
  const { preview } = await searchParams;
  const previewMode = preview === "1";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  // Courses are admin-only for now
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  let courseQuery = supabase
    .from("courses")
    .select("*")
    .eq("id", courseId);

  if (!previewMode) {
    courseQuery = courseQuery.eq("is_published", true);
  }

  const { data: course } = await courseQuery.single();

  if (!course) {
    redirect(previewMode ? `/dashboard/admin/courses/${courseId}` : "/courses");
  }

  const { data: modules } = await supabase
    .from("course_modules")
    .select("*")
    .eq("course_id", courseId)
    .eq("is_archived", false)
    .order("sort_order");

  const modulesWithActivities = await Promise.all(
    (modules ?? []).map(async (mod) => {
      const { data: activities } = await supabase
        .from("activities")
        .select("id, title, activity_type, phase, order_index, duration_minutes")
        .eq("module_id", mod.id)
        .eq("is_archived", false)
        .order("order_index");
      return { ...mod, activities: activities ?? [] };
    })
  );

  // Get enrollment
  let enrollment = null;
  let completedIds: Set<string> = new Set();

  if (!previewMode) {
    const { data: enrollmentData } = await supabase
      .from("enrollments")
      .select("*")
      .eq("course_id", courseId)
      .eq("user_id", user.id)
      .single();
    enrollment = enrollmentData;

    const allActivityIds = modulesWithActivities.flatMap((m) => m.activities.map((a: { id: string }) => a.id));
    const { data: attempts } = allActivityIds.length > 0
      ? await supabase
        .from("activity_attempts")
        .select("activity_id")
        .eq("user_id", user.id)
        .not("completed_at", "is", null)
        .in("activity_id", allActivityIds)
      : { data: [] };

    completedIds = new Set((attempts ?? []).map((a) => a.activity_id));
  }

  return (
    <CoursePlayerView
      course={course}
      modules={modulesWithActivities}
      enrollment={enrollment}
      completedActivityIds={Array.from(completedIds)}
      previewMode={previewMode}
      editorHref={`/dashboard/admin/courses/${courseId}`}
      publicationState={course.is_published ? "published" : "draft"}
    />
  );
}
