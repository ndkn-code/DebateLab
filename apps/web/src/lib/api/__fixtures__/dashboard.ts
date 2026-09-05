import type { SupabaseClient } from "@supabase/supabase-js";

// Synthetic evidence only. Never use this client in a production route.
export const DASHBOARD_FIXTURE_USER = "00000000-0000-0000-0000-000000000073";
export const DASHBOARD_FIXTURE_NOW = new Date("2026-09-05T12:00:00Z");
export const dashboardFixtureProfile = {
  id: DASHBOARD_FIXTURE_USER,
  display_name: "Minh Nguyễn",
  avatar_url: null,
  role: "student",
  streak_current: 0,
  streak_longest: 0,
  streak_last_active_date: null,
  total_practice_minutes: 0,
  total_sessions_completed: 0,
  xp: 230,
  level: 3,
  onboarding_completed: true,
  preferences: { daily_goal_minutes: 20, fixture_marker: "preserve-me" },
  orb_balance: 1250,
  referral_code: null,
};
export function dashboardFixtureSession(
  track: "speaking" | "debate",
  scored = false,
) {
  return {
    id: `fixture-${track}`,
    topic_title: `QA: ${track} practice`,
    category: "education",
    topic_difficulty: "beginner",
    side: "pro",
    mode: "solo",
    ai_difficulty: "easy",
    feedback: { practiceTrack: track },
    total_score: scored ? 72 : null,
    overall_band: scored ? "Competent" : null,
    duration_seconds: 600,
    created_at: "2026-09-05T10:00:00Z",
  };
}
type Source =
  | "profile"
  | "enrollments"
  | "recentSessions"
  | "scoredSessions"
  | "stats"
  | "activityLog";
type FixtureOptions = {
  sources?: Partial<Record<Source, unknown>>;
  failures?: Source[];
  rejections?: Source[];
  rpc?: { data: unknown; error: unknown } | "reject";
  errorWithData?: boolean;
};

export function createDashboardFixtureClient(options: FixtureOptions = {}) {
  const sources: Record<Source, unknown> = {
    profile: dashboardFixtureProfile,
    enrollments: [],
    recentSessions: [],
    scoredSessions: [],
    stats: [],
    activityLog: [],
    ...options.sources,
  };
  const calls: Array<{ table: string; source: Source; owner: string | null }> =
    [];
  const from = (table: string) => {
    let scored = false;
    let owner: string | null = null;
    const chain = {
      select: () => chain,
      eq: (key: string, value: string) => {
        if (key === "id" || key === "user_id") owner = value;
        return chain;
      },
      not: () => {
        scored = true;
        return chain;
      },
      gte: () => chain,
      lte: () => chain,
      order: () => chain,
      limit: () => chain,
      single: () => chain,
      then: (
        resolve: (value: unknown) => unknown,
        reject: (reason: unknown) => unknown,
      ) => {
        const source: Source =
          table === "profiles"
            ? "profile"
            : table === "enrollments"
              ? "enrollments"
              : table === "daily_stats"
                ? "stats"
                : table === "activity_log"
                  ? "activityLog"
                  : scored
                    ? "scoredSessions"
                    : "recentSessions";
        calls.push({ table, source, owner });
        const failed = options.failures?.includes(source);
        const result = options.rejections?.includes(source)
          ? Promise.reject(new Error("Mocked query rejection"))
          : Promise.resolve({
              data: failed && !options.errorWithData ? null : sources[source],
              error: failed ? { message: "Mocked source outage" } : null,
            });
        return result.then(resolve, reject);
      },
    };
    return chain;
  };
  const client = {
    rpc: () =>
      options.rpc === "reject"
        ? Promise.reject(new Error("Mocked RPC rejection"))
        : Promise.resolve(
            options.rpc ?? {
              data: null,
              error: { message: "Mocked RPC unavailable" },
            },
          ),
    from,
  } as unknown as SupabaseClient;
  return { client, calls };
}
