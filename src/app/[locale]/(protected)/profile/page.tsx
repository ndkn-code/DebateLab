import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProfileContent } from "@/components/profile/profile-content";

export const metadata = { title: "Profile — DebateLab" };

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const [profileRes, achievementsRes, userAchievementsRes, skillsRes, activityRes] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", user.id).single(),
      supabase.from("achievements").select("*").order("sort_order"),
      supabase
        .from("user_achievements")
        .select("achievement_id, unlocked_at")
        .eq("user_id", user.id),
      supabase.rpc("get_skill_breakdown", { p_user_id: user.id }),
      supabase
        .from("activity_log")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
    ]);

  const unlockedMap = new Map<string, string>();
  for (const ua of userAchievementsRes.data ?? []) {
    unlockedMap.set(ua.achievement_id, ua.unlocked_at);
  }

  const achievements = (achievementsRes.data ?? []).map((a) => ({
    ...a,
    unlocked: unlockedMap.has(a.id),
    unlocked_at: unlockedMap.get(a.id) ?? null,
  }));

  return (
    <ProfileContent
      profile={profileRes.data}
      achievements={achievements}
      skills={
        skillsRes.data ?? {
          content: 0,
          structure: 0,
          language: 0,
          persuasion: 0,
          total_sessions: 0,
        }
      }
      activity={activityRes.data ?? []}
    />
  );
}
