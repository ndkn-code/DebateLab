import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { CoursePlayerView } from "@/components/activities/CoursePlayerView";

export default async function CourseDetailPage({ params }: { params: Promise<{ courseId: string }> }) {
  const { courseId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .eq("is_published", true)
    .single();

  if (!course) redirect("/courses");

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
  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("*")
    .eq("course_id", courseId)
    .eq("user_id", user.id)
    .single();

  // Get completed attempts
  const allActivityIds = modulesWithActivities.flatMap((m) => m.activities.map((a: { id: string }) => a.id));
  const { data: attempts } = allActivityIds.length > 0
    ? await supabase
      .from("activity_attempts")
      .select("activity_id")
      .eq("user_id", user.id)
      .not("completed_at", "is", null)
      .in("activity_id", allActivityIds)
    : { data: [] };

  const completedIds = new Set((attempts ?? []).map((a) => a.activity_id));

  return (
    <CoursePlayerView
      course={course}
      modules={modulesWithActivities}
      enrollment={enrollment}
      completedActivityIds={Array.from(completedIds)}
      userId={user.id}
    />
  );
}
