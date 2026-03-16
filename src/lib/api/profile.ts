import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

interface AchievementRow {
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
  sort_order: number;
}

export interface ProfileAchievement extends AchievementRow {
  unlocked: boolean;
  unlocked_at: string | null;
}

export interface SkillBreakdown {
  content: number;
  structure: number;
  language: number;
  persuasion: number;
  total_sessions: number;
}

interface ActivityLogRow {
  id: string;
  user_id: string;
  activity_type: string;
  reference_id: string | null;
  reference_type: string | null;
  xp_earned: number;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface ProfileData {
  profile: Profile | null;
  achievements: ProfileAchievement[];
  skills: SkillBreakdown;
  activity: ActivityLogRow[];
}

export async function getProfileData(userId: string): Promise<ProfileData> {
  const supabase = await createClient();

  const [profileRes, achievementsRes, userAchievementsRes, skillsRes, activityRes] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).single(),
      supabase.from("achievements").select("*").order("sort_order"),
      supabase
        .from("user_achievements")
        .select("achievement_id, unlocked_at")
        .eq("user_id", userId),
      supabase.rpc("get_skill_breakdown", { p_user_id: userId }),
      supabase
        .from("activity_log")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  const unlockedMap = new Map<string, string>();
  for (const ua of (userAchievementsRes.data ?? []) as {
    achievement_id: string;
    unlocked_at: string;
  }[]) {
    unlockedMap.set(ua.achievement_id, ua.unlocked_at);
  }

  const achievements: ProfileAchievement[] = (
    (achievementsRes.data ?? []) as AchievementRow[]
  ).map((a) => ({
    ...a,
    unlocked: unlockedMap.has(a.id),
    unlocked_at: unlockedMap.get(a.id) ?? null,
  }));

  const defaultSkills: SkillBreakdown = {
    content: 0,
    structure: 0,
    language: 0,
    persuasion: 0,
    total_sessions: 0,
  };

  return {
    profile: (profileRes.data as Profile) ?? null,
    achievements,
    skills: (skillsRes.data as SkillBreakdown) ?? defaultSkills,
    activity: (activityRes.data as ActivityLogRow[]) ?? [],
  };
}
