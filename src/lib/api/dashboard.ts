import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";

export interface DashboardData {
  profile: Profile | null;
  enrollments: EnrollmentWithCourse[];
  recentSessions: RecentSession[];
  weeklyStats: DailyStatEntry[];
  nextLessons: NextLesson[];
}

export interface EnrollmentWithCourse {
  id: string;
  course_id: string;
  status: string;
  progress_percent: number;
  course_title: string;
  course_category: string;
  course_thumbnail_url: string | null;
}

export interface RecentSession {
  id: string;
  topic_title: string;
  topic_category: string;
  side: string;
  mode: string;
  practice_track: "speaking" | "debate";
  total_score: number | null;
  overall_band: string | null;
  duration_seconds: number;
  created_at: string;
}

export interface DailyStatEntry {
  date: string;
  sessions_completed: number;
  practice_minutes: number;
  xp_earned: number;
}

export interface NextLesson {
  id: string;
  title: string;
  type: string;
  duration_minutes: number;
  course_title: string;
  module_title: string;
}

function getWeekDates(): string[] {
  const dates: string[] = [];
  const now = new Date();
  // Get Monday of the current week
  const day = now.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}

export async function getDashboardData(
  userId: string
): Promise<DashboardData> {
  const supabase = await createClient();
  const weekDates = getWeekDates();

  // Fetch all data in parallel
  const [profileRes, enrollmentsRes, sessionsRes, weeklyRes] =
    await Promise.all([
      // Profile — select only fields used by dashboard
      supabase
        .from("profiles")
        .select("id, display_name, avatar_url, role, streak_current, streak_longest, streak_last_active_date, total_practice_minutes, total_sessions_completed, xp, level, onboarding_completed, preferences, orb_balance, referral_code")
        .eq("id", userId)
        .single(),

      // Active enrollments with course data (limit 3)
      supabase
        .from("enrollments")
        .select(
          "id, course_id, status, progress_percent, courses(title, category, thumbnail_url)"
        )
        .eq("user_id", userId)
        .eq("status", "active")
        .order("progress_percent", { ascending: false })
        .limit(3),

      // Recent debate sessions (limit 3)
      supabase
        .from("debate_sessions")
        .select(
          "id, topic_title, category, side, mode, feedback, total_score, overall_band, duration_seconds, created_at"
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(3),

      // Weekly daily stats
      supabase
        .from("daily_stats")
        .select("date, sessions_completed, minutes_studied, xp_earned")
        .eq("user_id", userId)
        .gte("date", weekDates[0])
        .lte("date", weekDates[6])
        .order("date"),
    ]);

  // Map enrollments with course data
  const enrollments: EnrollmentWithCourse[] = (enrollmentsRes.data ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (e: any) => ({
      id: e.id,
      course_id: e.course_id,
      status: e.status,
      progress_percent: e.progress_percent,
      course_title: e.courses?.title ?? "Unknown Course",
      course_category: e.courses?.category ?? "",
      course_thumbnail_url: e.courses?.thumbnail_url ?? null,
    })
  );

  // Map recent sessions
  const recentSessions: RecentSession[] = (sessionsRes.data ?? []).map(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (s: any) => ({
      id: s.id,
      topic_title: s.topic_title,
      topic_category: s.category,
      side: s.side,
      mode: s.mode,
      practice_track: s.feedback?.practiceTrack === "speaking" ? "speaking" : "debate",
      total_score: s.total_score,
      overall_band: s.overall_band,
      duration_seconds: s.duration_seconds,
      created_at: s.created_at,
    })
  );

  // Fill in all 7 days of the week
  const weeklyMap = new Map<string, DailyStatEntry>();
  for (const date of weekDates) {
    weeklyMap.set(date, {
      date,
      sessions_completed: 0,
      practice_minutes: 0,
      xp_earned: 0,
    });
  }
  for (const stat of weeklyRes.data ?? []) {
    weeklyMap.set(stat.date, {
      date: stat.date,
      sessions_completed: stat.sessions_completed,
      practice_minutes: stat.minutes_studied,
      xp_earned: stat.xp_earned,
    });
  }
  const weeklyStats = weekDates.map((d) => weeklyMap.get(d)!);

  const profile = profileRes.data as Profile | null;

  return {
    profile,
    enrollments,
    recentSessions,
    weeklyStats,
    nextLessons: [], // Will be populated when courses are implemented
  };
}
