"use server";

import { createClient } from "@/lib/supabase/server";

export async function completeOnboarding(preferences: {
  goal: string | null;
  experience_level: string | null;
  english_confidence: string | null;
  daily_goal_minutes: number | null;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Upsert profile with onboarding data
  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email ?? "",
      display_name:
        user.user_metadata?.display_name ||
        user.email?.split("@")[0] ||
        "",
      onboarding_completed: true,
      preferences: {
        ...preferences,
        first_dashboard_visit: true,
      },
    },
    { onConflict: "id" }
  );

  if (profileError) {
    console.error("Failed to complete onboarding:", profileError);
    return { error: profileError.message };
  }

  // Try to enroll in recommended course
  const slug =
    preferences.experience_level === "experienced"
      ? "public-speaking-mastery"
      : "foundations-of-competitive-debate";

  const { data: course } = await supabase
    .from("courses")
    .select("id")
    .eq("slug", slug)
    .single();

  if (course) {
    await supabase.from("enrollments").upsert(
      {
        user_id: user.id,
        course_id: course.id,
        status: "active",
        progress_percent: 0,
      },
      { onConflict: "user_id,course_id" }
    );
  }

  return { success: true };
}
