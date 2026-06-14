import "server-only";

import { DEV_ADMIN_PROFILE } from "@/lib/dev-admin-bypass";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";
import {
  PROFILE_PUBLIC_READS_ENABLED,
  PROFILE_SOCIAL_ENABLED,
} from "@/lib/features";
import { createClient } from "@/lib/supabase/server";
import {
  coerceProfileAchievementsData,
  coerceProfileActivityFeedData,
  coerceProfileAnalyticsTabData,
  type ProfileAchievementsData,
  type ProfileActivityKind,
  type ProfileActivityFeedData,
  type ProfileAnalyticsTabData,
} from "@/lib/profile-social/tab-model";
import {
  computeEffectiveStreakState,
  type StreakActivityEvent,
} from "@/lib/streaks/model";
import type { AnalyticsRangePreset, PracticeLanguage } from "@/types";

type RpcResult = {
  data: unknown;
  error: { message?: string; code?: string } | null;
};
type RpcClient = {
  rpc: (fn: string, args?: Record<string, unknown>) => Promise<RpcResult>;
};
type UnsafeSupabaseClient = RpcClient & {
  // The project does not expose a generated Supabase client type here yet.
  // Keep fallback reads narrow and self-scoped while migrations roll forward.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
};

export interface GetProfileTabDataInput {
  targetUserId?: string | null;
  handle?: string | null;
  leaderboardLanguage?: PracticeLanguage;
  range?: AnalyticsRangePreset;
  previewAsPublic?: boolean;
}

function rpcClient(supabase: unknown): RpcClient {
  return supabase as RpcClient;
}

function queryClient(supabase: unknown): UnsafeSupabaseClient {
  return supabase as UnsafeSupabaseClient;
}

function isMissingRpc(error: { message?: string; code?: string } | null) {
  return (
    error?.code === "PGRST202" ||
    Boolean(error?.message?.includes("Could not find the function"))
  );
}

function canUseSelfFallback(input: GetProfileTabDataInput, userId: string | null) {
  if (!userId) {
    return false;
  }

  if (input.targetUserId) {
    return input.targetUserId === userId;
  }

  return !input.handle;
}

function isSelfDevTarget(input: GetProfileTabDataInput) {
  if (input.targetUserId) {
    return input.targetUserId === DEV_ADMIN_PROFILE.id;
  }

  if (input.handle) {
    return input.handle === DEV_ADMIN_PROFILE.handle;
  }

  return true;
}

function makeDevAnalyticsData(input: GetProfileTabDataInput): ProfileAnalyticsTabData {
  const isSelf = isSelfDevTarget(input) && !input.previewAsPublic;

  return {
    state: "visible",
    viewerMode: isSelf ? "self" : "public",
    range: input.range ?? "30d",
    practiceLanguage: input.leaderboardLanguage ?? "en",
    totalPracticeMinutes: isSelf ? 245 : 132,
    totalSessions: isSelf ? 18 : 9,
    averageScore: isSelf ? 84 : 78,
    speakingCount: isSelf ? 7 : 4,
    debateCount: isSelf ? 11 : 5,
    level: isSelf ? DEV_ADMIN_PROFILE.level : 3,
    lifetimeXp: isSelf ? DEV_ADMIN_PROFILE.xp : 860,
  };
}

function makeDevActivityData(input: GetProfileTabDataInput): ProfileActivityFeedData {
  const isSelf = isSelfDevTarget(input) && !input.previewAsPublic;

  return {
    state: "visible",
    viewerMode: isSelf ? "self" : "public",
    items: [
      {
        id: "dev-practice-1",
        kind: "practice",
        title: "Should cities ban private cars downtown?",
        subtitle: "Constructive focus",
        createdAt: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
        xpEarned: 40,
        score: 88,
        durationMinutes: 16,
        href: isSelf ? "/history/dev-practice-1" : null,
      },
      {
        id: "dev-duel-1",
        kind: "duel",
        title: "AI should be allowed in classrooms",
        subtitle: "Won as opposition",
        createdAt: new Date(Date.now() - 1000 * 60 * 60 * 28).toISOString(),
        xpEarned: 75,
        score: null,
        durationMinutes: 21,
        href: isSelf ? "/debates/dev-duel/result" : null,
      },
    ],
  };
}

const DEV_ACHIEVEMENTS = [
  {
    id: "constructive-climber",
    slug: "constructive_climber",
    title: "Constructive Climber",
    description: "Complete your first strong constructive case.",
    category: "debate",
    icon: "△",
    titleReward: "Constructive Climber",
    xpReward: 100,
    conditionType: "sessions_completed",
    conditionValue: 1,
    sortOrder: 1,
    unlocked: true,
    unlockedAt: new Date(Date.now() - 1000 * 60 * 60 * 7).toISOString(),
    progressValue: 1,
    progressTarget: 1,
    progressPercent: 100,
    isFeatured: true,
  },
  {
    id: "rebuttal-streak",
    slug: "rebuttal_streak",
    title: "Rebuttal Streak",
    description: "Practice rebuttals across five sessions.",
    category: "practice",
    icon: "↯",
    titleReward: "Rebuttal Streak",
    xpReward: 150,
    conditionType: "sessions_completed",
    conditionValue: 5,
    sortOrder: 2,
    unlocked: false,
    unlockedAt: null,
    progressValue: 3,
    progressTarget: 5,
    progressPercent: 60,
    isFeatured: false,
  },
  {
    id: "evidence-builder",
    slug: "evidence_builder",
    title: "Evidence Builder",
    description: "Earn an 80+ score on evidence and logic.",
    category: "mastery",
    icon: "▤",
    titleReward: "Evidence Builder",
    xpReward: 200,
    conditionType: "score_above",
    conditionValue: 80,
    sortOrder: 3,
    unlocked: true,
    unlockedAt: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
    progressValue: 84,
    progressTarget: 80,
    progressPercent: 100,
    isFeatured: true,
  },
  {
    id: "crossfire-ready",
    slug: "crossfire_ready",
    title: "Crossfire Ready",
    description: "Win a duel and show strong clash awareness.",
    category: "duel",
    icon: "✦",
    titleReward: "Crossfire Ready",
    xpReward: 250,
    conditionType: "level_reached",
    conditionValue: 4,
    sortOrder: 4,
    unlocked: true,
    unlockedAt: new Date(Date.now() - 1000 * 60 * 60 * 54).toISOString(),
    progressValue: 4,
    progressTarget: 4,
    progressPercent: 100,
    isFeatured: true,
  },
];

function makeDevAchievementsData(input: GetProfileTabDataInput): ProfileAchievementsData {
  const isSelf = isSelfDevTarget(input) && !input.previewAsPublic;
  const achievements = isSelf
    ? DEV_ACHIEVEMENTS
    : DEV_ACHIEVEMENTS.filter((achievement) => achievement.unlocked);

  return {
    state: "visible",
    viewerMode: isSelf ? "self" : "public",
    featured: achievements.filter((achievement) => achievement.isFeatured),
    achievements,
    categories: ["debate", "duel", "mastery", "practice"],
    unlockedCount: DEV_ACHIEVEMENTS.filter((achievement) => achievement.unlocked).length,
    totalCount: isSelf ? DEV_ACHIEVEMENTS.length : achievements.length,
    maxFeatured: 4,
  };
}

function asPublicPreviewAnalytics(
  data: ProfileAnalyticsTabData
): ProfileAnalyticsTabData {
  return {
    ...data,
    viewerMode: "public",
  };
}

function asPublicPreviewActivity(
  data: ProfileActivityFeedData
): ProfileActivityFeedData {
  return {
    ...data,
    viewerMode: "public",
    items: data.items.map((item) => ({
      ...item,
      href: null,
    })),
  };
}

function asPublicPreviewAchievements(
  data: ProfileAchievementsData
): ProfileAchievementsData {
  const achievements = data.achievements.filter(
    (achievement) => achievement.unlocked
  );
  const achievementIds = new Set(achievements.map((achievement) => achievement.id));

  return {
    ...data,
    viewerMode: "public",
    achievements,
    featured: data.featured.filter((achievement) =>
      achievementIds.has(achievement.id)
    ),
    unlockedCount: achievements.length,
    totalCount: achievements.length,
  };
}

async function getRpcContext() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const devUser = user ? null : await getDevAuthBypassUserFromServerContext();

  if (!user && !devUser) {
    throw new Error("Unauthorized");
  }

  return {
    supabase,
    userId: user?.id ?? devUser?.id ?? null,
    isDevBypass: !user && Boolean(devUser),
  };
}

function assertProfileReadsEnabled(isDevBypass: boolean) {
  if (isDevBypass) return;
  if (!PROFILE_SOCIAL_ENABLED || !PROFILE_PUBLIC_READS_ENABLED) {
    throw new Error("Profile public reads are not enabled yet.");
  }
}

export async function getProfileAnalyticsTabData(
  input: GetProfileTabDataInput
): Promise<ProfileAnalyticsTabData> {
  const { supabase, userId, isDevBypass } = await getRpcContext();
  assertProfileReadsEnabled(isDevBypass);

  if (isDevBypass) {
    return makeDevAnalyticsData(input);
  }

  const { data, error } = await rpcClient(supabase).rpc(
    "get_profile_analytics_summary",
    {
      p_target_user_id: input.targetUserId ?? null,
      p_handle: input.handle ?? null,
      p_range: input.range ?? "30d",
      p_leaderboard_language: input.leaderboardLanguage ?? "en",
    }
  );

  if (error) {
    if (isMissingRpc(error) && canUseSelfFallback(input, userId)) {
      return makeDevAnalyticsData(input);
    }
    throw new Error(error.message ?? "Unable to load profile analytics.");
  }

  const tabData = coerceProfileAnalyticsTabData(data);
  return input.previewAsPublic ? asPublicPreviewAnalytics(tabData) : tabData;
}

export async function getProfileActivityFeedData(
  input: GetProfileTabDataInput
): Promise<ProfileActivityFeedData> {
  const { supabase, userId, isDevBypass } = await getRpcContext();
  assertProfileReadsEnabled(isDevBypass);

  if (isDevBypass) {
    return makeDevActivityData(input);
  }

  const { data, error } = await rpcClient(supabase).rpc("get_profile_activity_feed", {
    p_target_user_id: input.targetUserId ?? null,
    p_handle: input.handle ?? null,
    p_leaderboard_language: input.leaderboardLanguage ?? "en",
    p_limit: 80,
  });

  if (error) {
    if (isMissingRpc(error) && canUseSelfFallback(input, userId)) {
      const fallback = await getSelfFallbackActivityFeedData(
        supabase,
        userId!,
        input
      );
      return input.previewAsPublic
        ? asPublicPreviewActivity(fallback)
        : fallback;
    }
    throw new Error(error.message ?? "Unable to load profile activities.");
  }

  const tabData = coerceProfileActivityFeedData(data);
  return input.previewAsPublic ? asPublicPreviewActivity(tabData) : tabData;
}

export async function getProfileAchievementsData(
  input: GetProfileTabDataInput
): Promise<ProfileAchievementsData> {
  const { supabase, userId, isDevBypass } = await getRpcContext();
  assertProfileReadsEnabled(isDevBypass);

  if (isDevBypass) {
    return makeDevAchievementsData(input);
  }

  const { data, error } = await rpcClient(supabase).rpc("get_profile_achievements", {
    p_target_user_id: input.targetUserId ?? null,
    p_handle: input.handle ?? null,
    p_leaderboard_language: input.leaderboardLanguage ?? "en",
  });

  if (error) {
    if (isMissingRpc(error) && canUseSelfFallback(input, userId)) {
      const fallback = await getSelfFallbackAchievementsData(supabase, userId!);
      return input.previewAsPublic
        ? asPublicPreviewAchievements(fallback)
        : fallback;
    }
    throw new Error(error.message ?? "Unable to load profile achievements.");
  }

  const tabData = coerceProfileAchievementsData(data);
  return input.previewAsPublic ? asPublicPreviewAchievements(tabData) : tabData;
}

async function getSelfFallbackActivityFeedData(
  supabase: unknown,
  userId: string,
  input: GetProfileTabDataInput
): Promise<ProfileActivityFeedData> {
  const client = queryClient(supabase);
  const language = input.leaderboardLanguage ?? "en";
  let sessionsQuery = client
    .from("debate_sessions")
    .select("id, topic_title, topic_category, total_score, duration_seconds, practice_language, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(40);

  sessionsQuery =
    language === "vi"
      ? sessionsQuery.eq("practice_language", "vi")
      : sessionsQuery.or("practice_language.eq.en,practice_language.is.null");

  const [sessionsRes, activityRes] = await Promise.all([
    sessionsQuery,
    client
      .from("activity_log")
      .select("id, activity_type, metadata, xp_earned, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const sessionItems = ((sessionsRes.data ?? []) as Array<Record<string, unknown>>).map(
    (session) => ({
      id: `practice:${String(session.id)}`,
      kind: "practice" as const,
      title: String(session.topic_title ?? "Practice session"),
      subtitle: typeof session.topic_category === "string" ? session.topic_category : null,
      createdAt: String(session.created_at ?? new Date(0).toISOString()),
      xpEarned: 0,
      score:
        typeof session.total_score === "number" && Number.isFinite(session.total_score)
          ? session.total_score
          : null,
      durationMinutes:
        typeof session.duration_seconds === "number" && session.duration_seconds > 0
          ? Math.max(1, Math.round(session.duration_seconds / 60))
          : null,
      href: `/history/${String(session.id)}`,
    })
  );
  const activityItems = ((activityRes.data ?? []) as Array<Record<string, unknown>>)
    .filter((activity) => {
      const activityType = String(activity.activity_type ?? "");
      return (
        activityType !== "debate_completed" &&
        !activityType.includes("achievement")
      );
    })
    .map((activity) => {
      const metadata =
        typeof activity.metadata === "object" && activity.metadata !== null
          ? (activity.metadata as Record<string, unknown>)
          : {};
      const activityType = String(activity.activity_type ?? "activity");
      const title =
        metadata.title ??
        metadata.course_title ??
        metadata.lesson_title ??
        activityType.replace(/_/g, " ");
      const kind: ProfileActivityKind = activityType.includes("course")
        ? "course"
        : activityType.includes("lesson")
          ? "lesson"
          : activityType.includes("level")
            ? "level"
            : "activity";

      return {
        id: `activity:${String(activity.id)}`,
        kind,
        title: String(title),
        subtitle: activityType.replace(/_/g, " "),
        createdAt: String(activity.created_at ?? new Date(0).toISOString()),
        xpEarned:
          typeof activity.xp_earned === "number" && Number.isFinite(activity.xp_earned)
            ? activity.xp_earned
            : 0,
        score: null,
        durationMinutes: null,
        href: null,
      };
    });
  return {
    state: "visible",
    viewerMode: "self",
    items: [...sessionItems, ...activityItems]
      .sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
      )
      .slice(0, 80),
  };
}

async function getSelfFallbackAchievementsData(
  supabase: unknown,
  userId: string
): Promise<ProfileAchievementsData> {
  const client = queryClient(supabase);
  const [profileRes, achievementsRes, unlockedRes, scoresRes, coursesRes, activityRes] =
    await Promise.all([
      client
        .from("profiles")
        .select("total_sessions_completed, streak_current, streak_longest, streak_last_active_date, total_practice_minutes, level")
        .eq("id", userId)
        .single(),
      client.from("achievements").select("*").order("sort_order"),
      client
        .from("user_achievements")
        .select("achievement_id, unlocked_at")
        .eq("user_id", userId),
      client
        .from("debate_sessions")
        .select("total_score")
        .eq("user_id", userId)
        .not("total_score", "is", null),
      client
        .from("enrollments")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "completed"),
      client
        .from("activity_log")
        .select("activity_type, reference_type, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(500),
    ]);

  const profile = (profileRes.data ?? {}) as Record<string, unknown>;
  const unlockedMap = new Map(
    ((unlockedRes.data ?? []) as Array<Record<string, unknown>>).map((row) => [
      String(row.achievement_id),
      typeof row.unlocked_at === "string" ? row.unlocked_at : null,
    ])
  );
  const scores = ((scoresRes.data ?? []) as Array<Record<string, unknown>>)
    .map((row) => (typeof row.total_score === "number" ? row.total_score : 0));
  const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
  const completedCourses = Array.isArray(coursesRes.data) ? coursesRes.data.length : 0;
  const effectiveStreak = computeEffectiveStreakState({
    profile,
    activities: (activityRes.data ?? []) as StreakActivityEvent[],
  });

  function progressValue(conditionType: string) {
    if (conditionType === "score_above") return maxScore;
    if (conditionType === "courses_completed") return completedCourses;
    if (conditionType === "sessions_completed") {
      return typeof profile.total_sessions_completed === "number"
        ? profile.total_sessions_completed
        : 0;
    }
    if (conditionType === "streak_days") {
      return Math.max(
        effectiveStreak.current,
        typeof profile.streak_longest === "number" ? profile.streak_longest : 0
      );
    }
    if (conditionType === "practice_minutes") {
      return typeof profile.total_practice_minutes === "number"
        ? profile.total_practice_minutes
        : 0;
    }
    if (conditionType === "level_reached") {
      return typeof profile.level === "number" ? profile.level : 1;
    }
    return 0;
  }

  const achievements = ((achievementsRes.data ?? []) as Array<Record<string, unknown>>).map(
    (achievement) => {
      const id = String(achievement.id);
      const conditionType = String(achievement.condition_type ?? "");
      const target =
        typeof achievement.condition_value === "number" ? achievement.condition_value : 0;
      const value = progressValue(conditionType);
      const unlockedAt = unlockedMap.get(id) ?? null;
      const unlocked = unlockedMap.has(id);

      return {
        id,
        slug: String(achievement.slug ?? id),
        title: String(achievement.title ?? "Achievement"),
        description: String(achievement.description ?? ""),
        category: String(achievement.category ?? "general"),
        icon: String(achievement.icon ?? "*"),
        titleReward:
          typeof achievement.title_reward === "string" ? achievement.title_reward : null,
        xpReward: typeof achievement.xp_reward === "number" ? achievement.xp_reward : 0,
        conditionType,
        conditionValue: target,
        sortOrder: typeof achievement.sort_order === "number" ? achievement.sort_order : 0,
        unlocked,
        unlockedAt,
        progressValue: value,
        progressTarget: target,
        progressPercent: unlocked
          ? 100
          : target > 0
            ? Math.max(0, Math.min(100, Math.round((value / target) * 100)))
            : 0,
        isFeatured: false,
      };
    }
  );
  const featured = achievements
    .filter((achievement) => achievement.unlocked)
    .sort(
      (left, right) =>
        new Date(right.unlockedAt ?? 0).getTime() -
          new Date(left.unlockedAt ?? 0).getTime() || left.sortOrder - right.sortOrder
    )
    .slice(0, 4)
    .map((achievement) => ({ ...achievement, isFeatured: true }));
  const featuredIds = new Set(featured.map((achievement) => achievement.id));
  const achievementsWithFeatured = achievements.map((achievement) => ({
    ...achievement,
    isFeatured: featuredIds.has(achievement.id),
  }));

  return {
    state: "visible",
    viewerMode: "self",
    featured,
    achievements: achievementsWithFeatured,
    categories: Array.from(
      new Set(achievementsWithFeatured.map((achievement) => achievement.category))
    ).sort(),
    unlockedCount: achievementsWithFeatured.filter((achievement) => achievement.unlocked)
      .length,
    totalCount: achievementsWithFeatured.length,
    maxFeatured: 4,
  };
}
