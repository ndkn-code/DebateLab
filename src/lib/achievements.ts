import { createClient } from "@/lib/supabase/client";
import { useAchievementStore } from "@/stores/achievement-store";
import posthog from "posthog-js";

interface Achievement {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  title_reward: string | null;
  xp_reward: number;
  condition_type: string;
  condition_value: number;
}

export async function checkAndUnlockAchievements(
  userId: string
): Promise<Achievement[]> {
  const supabase = createClient();

  // Fetch all data in parallel
  const [profileRes, achievementsRes, unlockedRes, scoresRes, coursesRes] =
    await Promise.all([
      supabase
        .from("profiles")
        .select(
          "total_sessions_completed, streak_current, streak_longest, total_practice_minutes, level"
        )
        .eq("id", userId)
        .single(),
      supabase.from("achievements").select("*").order("sort_order"),
      supabase
        .from("user_achievements")
        .select("achievement_id")
        .eq("user_id", userId),
      supabase
        .from("debate_sessions")
        .select("total_score")
        .eq("user_id", userId)
        .not("total_score", "is", null),
      supabase
        .from("enrollments")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "completed"),
    ]);

  const profile = profileRes.data;
  const allAchievements = (achievementsRes.data ?? []) as Achievement[];
  const unlockedIds = new Set(
    (unlockedRes.data ?? []).map(
      (u: { achievement_id: string }) => u.achievement_id
    )
  );
  const scores = (scoresRes.data ?? []).map(
    (s: { total_score: number }) => s.total_score
  );
  const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
  const completedCourses = coursesRes.data?.length ?? 0;

  if (!profile) return [];

  const newlyUnlocked: Achievement[] = [];

  for (const achievement of allAchievements) {
    if (unlockedIds.has(achievement.id)) continue;

    let met = false;
    switch (achievement.condition_type) {
      case "sessions_completed":
        met =
          (profile.total_sessions_completed ?? 0) >= achievement.condition_value;
        break;
      case "score_above":
        met = maxScore >= achievement.condition_value;
        break;
      case "streak_days":
        met =
          Math.max(
            profile.streak_current ?? 0,
            profile.streak_longest ?? 0
          ) >= achievement.condition_value;
        break;
      case "courses_completed":
        met = completedCourses >= achievement.condition_value;
        break;
      case "practice_minutes":
        met =
          (profile.total_practice_minutes ?? 0) >= achievement.condition_value;
        break;
      case "level_reached":
        met = (profile.level ?? 1) >= achievement.condition_value;
        break;
    }

    if (met) {
      const { error } = await supabase.from("user_achievements").insert({
        user_id: userId,
        achievement_id: achievement.id,
      });

      if (!error) {
        newlyUnlocked.push(achievement);

        if (achievement.title_reward) {
          const { data: profileData } = await supabase
            .from("profiles")
            .select("unlocked_titles")
            .eq("id", userId)
            .single();

          const titles: string[] = profileData?.unlocked_titles ?? [];
          if (!titles.includes(achievement.title_reward)) {
            await supabase
              .from("profiles")
              .update({ unlocked_titles: [...titles, achievement.title_reward] })
              .eq("id", userId);
          }
        }
      }
    }
  }

  // Show achievement toasts and track PostHog events
  for (const a of newlyUnlocked) {
    // Show Lottie achievement toast
    if (typeof window !== "undefined") {
      useAchievementStore.getState().showAchievement({
        title: a.title,
        description: a.description,
        icon: a.icon,
        titleReward: a.title_reward ?? undefined,
      });

      posthog.capture("achievement_unlocked", {
        achievement: a.slug,
        title_reward: a.title_reward,
        xp_reward: a.xp_reward,
      });
    }
  }

  return newlyUnlocked;
}
