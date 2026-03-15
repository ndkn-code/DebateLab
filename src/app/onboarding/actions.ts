"use server";

import { createClient } from "@/lib/supabase/server";

export async function completeOnboarding(preferences: {
  goal: string | null;
  experience_level: string | null;
  english_confidence: string | null;
  daily_goal_minutes: number | null;
}) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { error: "Not authenticated" };
    }

    // First check if profile exists
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .single();

    const profileData: Record<string, unknown> = {
      onboarding_completed: true,
      preferences: {
        ...preferences,
        first_dashboard_visit: true,
      },
    };

    let profileError;

    if (existing) {
      // Update existing profile
      const result = await supabase
        .from("profiles")
        .update(profileData)
        .eq("id", user.id);
      profileError = result.error;
    } else {
      // Insert new profile
      const result = await supabase.from("profiles").insert({
        id: user.id,
        email: user.email ?? "",
        display_name:
          user.user_metadata?.display_name ||
          user.email?.split("@")[0] ||
          "",
        ...profileData,
      });
      profileError = result.error;
    }

    if (profileError) {
      console.error("Failed to complete onboarding:", profileError);
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
      // Non-critical, ignore enrollment errors
    }

    return { success: true };
  } catch (err) {
    console.error("Onboarding action error:", err);
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
