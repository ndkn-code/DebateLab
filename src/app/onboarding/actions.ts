"use server";

import { createClient, createAdminClient } from "@/lib/supabase/server";

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

    // Use admin client to bypass RLS for profile writes
    const admin = createAdminClient();

    // Check if profile exists
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    const profilePrefs = {
      ...preferences,
      first_dashboard_visit: true,
    };

    let profileError;

    if (existing) {
      const result = await admin
        .from("profiles")
        .update({
          onboarding_completed: true,
          preferences: profilePrefs,
        })
        .eq("id", user.id);
      profileError = result.error;
    } else {
      const result = await admin.from("profiles").insert({
        id: user.id,
        email: user.email ?? "",
        display_name:
          user.user_metadata?.display_name ||
          user.email?.split("@")[0] ||
          "",
        onboarding_completed: true,
        preferences: profilePrefs,
      });
      profileError = result.error;
    }

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

      const { data: course } = await admin
        .from("courses")
        .select("id")
        .eq("slug", slug)
        .single();

      if (course) {
        await admin.from("enrollments").upsert(
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
