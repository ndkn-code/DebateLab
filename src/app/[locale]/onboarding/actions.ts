"use server";

import { createClient } from "@/lib/supabase/server";

export async function completeOnboarding(preferences: {
  goal: string | null;
  experience_level: string | null;
  english_confidence: string | null;
  daily_goal_minutes: number | null;
}) {
  try {
    // Use regular client for auth check
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    const profilePrefs = {
      ...preferences,
      first_dashboard_visit: true,
    };

    // Use update since the trigger already creates the profile row on signup
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        onboarding_completed: true,
        preferences: profilePrefs,
      })
      .eq("id", user.id);

    if (profileError) {
      console.error("completeOnboarding: profile write failed:", profileError);
      return { error: profileError.message };
    }

    // Try to enroll in recommended course (non-critical)
    try {
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
    } catch {
      // Non-critical
    }

    return { success: true };
  } catch (err) {
    console.error("completeOnboarding: uncaught error:", err);
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
