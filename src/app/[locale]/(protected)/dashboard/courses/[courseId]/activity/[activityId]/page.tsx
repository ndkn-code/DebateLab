import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ActivityPlayerWrapper } from "@/components/activities/ActivityPlayerWrapper";

export default async function ActivityPlayerPage({
  params,
  searchParams,
}: {
  params: Promise<{ courseId: string; activityId: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const { courseId, activityId } = await params;
  const { preview } = await searchParams;
  const previewMode = preview === "1";
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/dashboard");
  const isAdmin = profile.role === "admin";

  const { data: course } = await supabase
    .from("courses")
    .select("slug, title, is_published")
    .eq("id", courseId)
    .single();

  if (!course) {
    redirect(previewMode && isAdmin ? `/dashboard/admin/courses/${courseId}` : "/courses");
  }

  if (previewMode && !isAdmin) {
    redirect(`/courses/${course.slug}`);
  }

  if (!previewMode && !course.is_published && !isAdmin) {
    redirect("/courses");
  }

  if (!previewMode && !isAdmin) {
    const { data: enrollment } = await supabase
      .from("enrollments")
      .select("id")
      .eq("user_id", user.id)
      .eq("course_id", courseId)
      .maybeSingle();

    if (!enrollment) {
      redirect(`/courses/${course.slug}`);
    }
  }

  // Fetch the activity
  const { data: activity } = await supabase
    .from("activities")
    .select("*")
    .eq("id", activityId)
    .single();

  const courseOverviewHref = previewMode
    ? `/dashboard/courses/${courseId}?preview=1`
    : isAdmin
      ? `/dashboard/courses/${courseId}`
      : `/courses/${course.slug}`;

  if (!activity) redirect(courseOverviewHref);

  // Fetch module info
  const { data: moduleData } = await supabase
    .from("course_modules")
    .select("id, title, course_id")
    .eq("id", activity.module_id)
    .single();

  if (!moduleData) redirect(courseOverviewHref);

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
  let completedActivityIds: string[] = [];

  if (!previewMode) {
    const allActivityIds = allModules.flatMap((m) => m.activities.map((a) => a.id));
    const { data: completedAttempts } = allActivityIds.length > 0
      ? await supabase
          .from("activity_attempts")
          .select("activity_id")
          .eq("user_id", user.id)
          .not("completed_at", "is", null)
          .in("activity_id", allActivityIds)
      : { data: [] };

    completedActivityIds = [...new Set((completedAttempts ?? []).map((a) => a.activity_id))];
  }

  return (
    <ActivityPlayerWrapper
      activity={activity}
      courseId={courseId}
      courseTitle={course.title ?? "Course"}
      currentModule={currentModule}
      allModules={allModules}
      completedActivityIds={completedActivityIds}
      previewMode={previewMode}
      courseOverviewHref={courseOverviewHref}
    />
  );
}
