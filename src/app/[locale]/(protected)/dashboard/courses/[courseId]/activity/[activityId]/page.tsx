import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ActivityPlayerWrapper } from "@/components/activities/ActivityPlayerWrapper";

export default async function ActivityPlayerPage({
  params,
}: {
  params: Promise<{ courseId: string; activityId: string }>;
}) {
  const { courseId, activityId } = await params;
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

  // Fetch the activity
  const { data: activity } = await supabase
    .from("activities")
    .select("*")
    .eq("id", activityId)
    .single();

  if (!activity) redirect(`/dashboard/courses/${courseId}`);

  // Fetch module info
  const { data: moduleData } = await supabase
    .from("course_modules")
    .select("id, title, course_id")
    .eq("id", activity.module_id)
    .single();

  if (!moduleData) redirect(`/dashboard/courses/${courseId}`);

  // Fetch course title
  const { data: course } = await supabase
    .from("courses")
    .select("title")
    .eq("id", courseId)
    .single();

  // Fetch ALL modules with their activities for this course
  const { data: allModulesRaw } = await supabase
    .from("course_modules")
    .select("id, title")
    .eq("course_id", courseId)
    .eq("is_archived", false)
    .order("sort_order");

  const allModules = await Promise.all(
    (allModulesRaw ?? []).map(async (mod) => {
      const { data: activities } = await supabase
        .from("activities")
        .select("id, title, order_index, activity_type")
        .eq("module_id", mod.id)
        .eq("is_archived", false)
        .order("order_index");
      return { ...mod, activities: activities ?? [] };
    })
  );

  const currentModule = allModules.find((m) => m.id === activity.module_id) ?? {
    id: moduleData.id,
    title: moduleData.title,
    activities: [],
  };

  // Fetch user's completed activity IDs for this course
  const allActivityIds = allModules.flatMap((m) => m.activities.map((a) => a.id));
  const { data: completedAttempts } = allActivityIds.length > 0
    ? await supabase
        .from("activity_attempts")
        .select("activity_id")
        .eq("user_id", user.id)
        .not("completed_at", "is", null)
        .in("activity_id", allActivityIds)
    : { data: [] };

  const completedActivityIds = [...new Set((completedAttempts ?? []).map((a) => a.activity_id))];

  return (
    <ActivityPlayerWrapper
      activity={activity}
      courseId={courseId}
      courseTitle={course?.title ?? "Course"}
      userId={user.id}
      currentModule={currentModule}
      allModules={allModules}
      completedActivityIds={completedActivityIds}
    />
  );
}
