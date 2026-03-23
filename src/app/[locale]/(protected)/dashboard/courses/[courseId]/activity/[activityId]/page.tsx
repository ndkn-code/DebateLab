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

  const { data: activity } = await supabase
    .from("activities")
    .select("*")
    .eq("id", activityId)
    .single();

  if (!activity) redirect(`/dashboard/courses/${courseId}`);

  // Get module info for navigation
  const { data: siblings } = await supabase
    .from("activities")
    .select("id, title, order_index")
    .eq("module_id", activity.module_id)
    .eq("is_archived", false)
    .order("order_index");

  const { data: moduleData } = await supabase
    .from("course_modules")
    .select("title, sort_order")
    .eq("id", activity.module_id)
    .single();

  return (
    <ActivityPlayerWrapper
      activity={activity}
      courseId={courseId}
      userId={user.id}
      siblings={siblings ?? []}
      moduleTitle={moduleData?.title ?? "Module"}
      moduleIndex={moduleData?.sort_order ?? 0}
    />
  );
}
