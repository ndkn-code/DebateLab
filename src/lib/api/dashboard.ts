import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";
import type { DebateScore, PracticeTrack } from "@/types/feedback";

const USER_TIMEZONE = "America/New_York";
const STRONG_BANDS = new Set(["Competent", "Proficient", "Expert"]);
const DAYS_IN_WEEK = 7;

type DashboardNavKey =
  | "dashboard"
  | "speaking"
  | "debate"
  | "courses"
  | "coach"
  | "feedback"
  | "history"
  | "bookmarks"
  | "analytics";

type DashboardActionKey =
  | "speaking"
  | "debate"
  | "course"
  | "coach";

type DashboardSkillKey =
  | "clarity"
  | "logic"
  | "rebuttal"
  | "evidence"
  | "delivery";

type DashboardTaskKey =
  | "continue-course"
  | "weakest-skill"
  | "underused-track"
  | "review-feedback"
  | "live-match";

type DashboardRecentKind =
  | "speaking"
  | "debate"
  | "course"
  | "lesson"
  | "level"
  | "streak";

type DashboardMetricKey =
  | "total-sessions"
  | "strong-rate"
  | "average-score"
  | "practice-time";

type SessionScoreRow = {
  id: string;
  topic_title: string;
  category: string | null;
  side: string;
  mode: string;
  feedback: DebateScore | null;
  total_score: number | null;
  overall_band: string | null;
  duration_seconds: number;
  created_at: string;
};

type EnrollmentRow = {
  id: string;
  course_id: string;
  status: string;
  progress_pct: number;
  courses: {
    title: string;
    category: string;
    thumbnail_url: string | null;
  } | null;
};

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
  practice_track: PracticeTrack;
  total_score: number | null;
  overall_band: string | null;
  duration_seconds: number;
  created_at: string;
}

type ActivityLogRow = {
  id: string;
  activity_type: string;
  reference_id: string | null;
  reference_type: string | null;
  xp_earned: number;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

export interface DailyStatEntry {
  date: string;
  sessions_completed: number;
  practice_minutes: number;
  xp_earned: number;
}

export interface DashboardNavItem {
  key: DashboardNavKey;
  href?: string;
  status: "live" | "coming-soon";
}

export interface DashboardSkillMetric {
  key: DashboardSkillKey;
  value: number;
}

export interface DashboardSkillSnapshot {
  metrics: DashboardSkillMetric[];
  overallScore: number | null;
  weakestSkill: DashboardSkillKey | null;
  strongestSkill: DashboardSkillKey | null;
  sourceSessions: number;
}

export interface DashboardQuickAction {
  key: DashboardActionKey;
  href?: string;
  status: "live" | "coming-soon";
  descriptionKey: string;
}

export interface DashboardTask {
  key: DashboardTaskKey;
  href?: string;
  status: "live" | "coming-soon";
  progressLabel?: string;
  ctaKey: string;
  titleKey: string;
  description: string;
  skillKey?: DashboardSkillKey;
  track?: PracticeTrack;
}

export interface DashboardRecentItem {
  id: string;
  kind: DashboardRecentKind;
  title: string;
  subtitle: string;
  createdAt: string;
  href?: string;
  scoreOutOfFive?: number | null;
  statusLabel?: string | null;
  progressPercent?: number | null;
}

export interface DashboardProgressMetric {
  key: DashboardMetricKey;
  value: number;
  displayValue: string;
  delta: number | null;
}

export interface DashboardGoalSummary {
  goalMinutes: number;
  practicedMinutes: number;
  progressPercent: number;
  metGoal: boolean;
}

export interface DashboardCourseContinuation {
  courseId: string;
  title: string;
  category: string;
  progressPercent: number;
  href: string;
}

export interface DashboardHomeData {
  profile: Profile | null;
  nav: DashboardNavItem[];
  topBar: {
    currentStreak: number;
    orbBalance: number;
    level: number;
    xpCurrent: number;
    xpGoal: number;
    pendingNotifications: number;
  };
  hero: {
    weeklyStats: DailyStatEntry[];
    todayGoal: DashboardGoalSummary;
  };
  skillSnapshot: DashboardSkillSnapshot;
  quickActions: DashboardQuickAction[];
  recentActivity: DashboardRecentItem[];
  nextSteps: DashboardTask[];
  progress: DashboardProgressMetric[];
  sidebarCards: {
    dailyGoal: DashboardGoalSummary;
    inviteOrbs: number;
    referralCode: string | null;
  };
  courseContinuation: DashboardCourseContinuation | null;
}

function getDateFormatter() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: USER_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateInZone(date: Date) {
  return getDateFormatter().format(date);
}

function getTodayDateString() {
  return formatDateInZone(new Date());
}

function getCurrentWeekDates() {
  const dates: string[] = [];
  const now = new Date();
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: USER_TIMEZONE,
    weekday: "short",
  }).format(now);
  const weekdayIndexMap: Record<string, number> = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 0,
  };
  const dayIndex = weekdayIndexMap[weekday] ?? 0;
  const mondayOffset = dayIndex === 0 ? -6 : 1 - dayIndex;

  for (let index = 0; index < DAYS_IN_WEEK; index += 1) {
    const current = new Date(now);
    current.setDate(now.getDate() + mondayOffset + index);
    dates.push(formatDateInZone(current));
  }

  return dates;
}

function getTrailingDates(totalDays: number) {
  const dates: string[] = [];
  const now = new Date();

  for (let index = totalDays - 1; index >= 0; index -= 1) {
    const current = new Date(now);
    current.setDate(now.getDate() - index);
    dates.push(formatDateInZone(current));
  }

  return dates;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function roundToTenth(value: number) {
  return Math.round(value * 10) / 10;
}

function normalizeToFive(value: number, max: number) {
  if (!Number.isFinite(value) || max <= 0) return 0;
  return roundToTenth((value / max) * 5);
}

function getPracticeTrack(feedback: DebateScore | null): PracticeTrack {
  return feedback?.practiceTrack === "speaking" ? "speaking" : "debate";
}

function isStrongBand(band: string | null | undefined) {
  return band ? STRONG_BANDS.has(band) : false;
}

function getDailyGoalMinutes(profile: Profile | null) {
  const preferences = (profile?.preferences as Record<string, unknown> | null) ?? {};
  const explicitGoal = preferences.daily_goal_minutes;
  if (typeof explicitGoal === "number" && explicitGoal > 0) {
    return explicitGoal;
  }

  const onboardingGoal = preferences.dailyCommitment;
  if (typeof onboardingGoal === "number" && onboardingGoal > 0) {
    return onboardingGoal;
  }

  return 30;
}

function getXpGoal() {
  return 500;
}

function getStrongRate(sessions: SessionScoreRow[]) {
  const scored = sessions.filter((session) => session.total_score != null);
  if (scored.length === 0) return 0;
  const strongCount = scored.filter((session) =>
    isStrongBand(session.overall_band)
  ).length;
  return Math.round((strongCount / scored.length) * 100);
}

function getAverageArgumentScore(sessions: SessionScoreRow[]) {
  const scored = sessions.filter((session) => session.total_score != null);
  if (scored.length === 0) return 0;
  const average =
    scored.reduce((sum, session) => sum + (session.total_score ?? 0), 0) /
    scored.length;
  return roundToTenth(average / 20);
}

function buildGoalSummary(
  practicedMinutes: number,
  goalMinutes: number
): DashboardGoalSummary {
  const safeGoal = goalMinutes > 0 ? goalMinutes : 30;

  return {
    goalMinutes: safeGoal,
    practicedMinutes,
    progressPercent: Math.round(clamp((practicedMinutes / safeGoal) * 100, 0, 100)),
    metGoal: practicedMinutes >= safeGoal,
  };
}

function computeSkillSnapshot(scoredSessions: SessionScoreRow[]): DashboardSkillSnapshot {
  const sessionsWithFeedback = scoredSessions.filter(
    (session) => session.feedback?.content && session.feedback?.language
  );

  if (sessionsWithFeedback.length === 0) {
    return {
      metrics: [
        { key: "clarity", value: 0 },
        { key: "logic", value: 0 },
        { key: "rebuttal", value: 0 },
        { key: "evidence", value: 0 },
        { key: "delivery", value: 0 },
      ],
      overallScore: null,
      weakestSkill: null,
      strongestSkill: null,
      sourceSessions: 0,
    };
  }

  let clarityTotal = 0;
  let logicTotal = 0;
  let rebuttalTotal = 0;
  let evidenceTotal = 0;
  let deliveryTotal = 0;

  for (const session of sessionsWithFeedback) {
    const feedback = session.feedback!;
    clarityTotal += normalizeToFive(feedback.content.claimClarity, 10);
    logicTotal += normalizeToFive(feedback.content.logicCoherence, 10);
    rebuttalTotal += normalizeToFive(feedback.content.counterArgument, 10);
    evidenceTotal += normalizeToFive(feedback.content.evidenceSupport, 10);

    const deliveryAverage =
      normalizeToFive(feedback.language.vocabulary, 8) +
      normalizeToFive(feedback.language.grammar, 9) +
      normalizeToFive(feedback.language.fluency, 8);
    deliveryTotal += roundToTenth(deliveryAverage / 3);
  }

  const count = sessionsWithFeedback.length;
  const metrics: DashboardSkillMetric[] = [
    { key: "clarity", value: roundToTenth(clarityTotal / count) },
    { key: "logic", value: roundToTenth(logicTotal / count) },
    { key: "rebuttal", value: roundToTenth(rebuttalTotal / count) },
    { key: "evidence", value: roundToTenth(evidenceTotal / count) },
    { key: "delivery", value: roundToTenth(deliveryTotal / count) },
  ];

  const sorted = [...metrics].sort((left, right) => left.value - right.value);
  const overallScore = roundToTenth(
    metrics.reduce((sum, metric) => sum + metric.value, 0) / metrics.length
  );

  return {
    metrics,
    overallScore,
    weakestSkill: sorted[0]?.key ?? null,
    strongestSkill: sorted[sorted.length - 1]?.key ?? null,
    sourceSessions: count,
  };
}

function computePeriodDelta(currentValue: number, previousValue: number) {
  if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue)) return null;
  return roundToTenth(currentValue - previousValue);
}

function buildProgressMetrics(
  profile: Profile | null,
  scoredSessions: SessionScoreRow[],
  recent14Dates: string[],
  statsByDate: Map<string, DailyStatEntry>
): DashboardProgressMetric[] {
  const previousDates = recent14Dates.slice(0, 7);
  const currentDates = recent14Dates.slice(7);
  const currentDateSet = new Set(currentDates);
  const previousDateSet = new Set(previousDates);

  const currentPeriodSessions = scoredSessions.filter((session) =>
    currentDateSet.has(session.created_at.slice(0, 10))
  );
  const previousPeriodSessions = scoredSessions.filter((session) =>
    previousDateSet.has(session.created_at.slice(0, 10))
  );

  const currentPracticeMinutes = currentDates.reduce(
    (sum, date) => sum + (statsByDate.get(date)?.practice_minutes ?? 0),
    0
  );
  const previousPracticeMinutes = previousDates.reduce(
    (sum, date) => sum + (statsByDate.get(date)?.practice_minutes ?? 0),
    0
  );

  const totalSessions = profile?.total_sessions_completed ?? 0;
  const currentSessionCount = currentPeriodSessions.length;
  const previousSessionCount = previousPeriodSessions.length;
  const currentStrongRate = getStrongRate(
    currentPeriodSessions.length > 0 ? currentPeriodSessions : scoredSessions
  );
  const previousStrongRate = getStrongRate(previousPeriodSessions);
  const currentAverageScore = getAverageArgumentScore(
    currentPeriodSessions.length > 0 ? currentPeriodSessions : scoredSessions
  );
  const previousAverageScore = getAverageArgumentScore(previousPeriodSessions);

  return [
    {
      key: "total-sessions",
      value: totalSessions,
      displayValue: String(totalSessions),
      delta: computePeriodDelta(currentSessionCount, previousSessionCount),
    },
    {
      key: "strong-rate",
      value: currentStrongRate,
      displayValue: `${currentStrongRate}%`,
      delta: computePeriodDelta(currentStrongRate, previousStrongRate),
    },
    {
      key: "average-score",
      value: currentAverageScore,
      displayValue: `${currentAverageScore.toFixed(1)} / 5`,
      delta: computePeriodDelta(currentAverageScore, previousAverageScore),
    },
    {
      key: "practice-time",
      value: currentPracticeMinutes,
      displayValue: `${currentPracticeMinutes} min`,
      delta: computePeriodDelta(currentPracticeMinutes, previousPracticeMinutes),
    },
  ];
}

function buildRecentActivity(
  recentSessions: SessionScoreRow[],
  activityLog: ActivityLogRow[]
): DashboardRecentItem[] {
  const sessionItems: DashboardRecentItem[] = recentSessions.slice(0, 4).map((session) => {
    const practiceTrack = getPracticeTrack(session.feedback);
    return {
      id: `session-${session.id}`,
      kind: practiceTrack,
      title: session.topic_title,
      subtitle: practiceTrack === "speaking" ? "Speaking Practice" : "Debate Practice",
      createdAt: session.created_at,
      href: `/history/${session.id}`,
      scoreOutOfFive:
        session.total_score != null ? roundToTenth(session.total_score / 20) : null,
      statusLabel: session.overall_band,
      progressPercent: null,
    };
  });

  const activityItems: DashboardRecentItem[] = activityLog
    .filter((entry) =>
      ["course_started", "lesson_completed", "course_completed", "level_up"].includes(
        entry.activity_type
      )
    )
    .slice(0, 4)
    .map((entry) => {
      const metadata = entry.metadata ?? {};

      if (entry.activity_type === "lesson_completed") {
        return {
          id: `activity-${entry.id}`,
          kind: "lesson",
          title:
            typeof metadata.lesson_title === "string"
              ? metadata.lesson_title
              : "Completed a lesson",
          subtitle:
            typeof metadata.course_title === "string"
              ? metadata.course_title
              : "Course progress updated",
          createdAt: entry.created_at,
        };
      }

      if (entry.activity_type === "course_completed") {
        return {
          id: `activity-${entry.id}`,
          kind: "course",
          title:
            typeof metadata.course_title === "string"
              ? metadata.course_title
              : "Completed a course",
          subtitle: "Course milestone",
          createdAt: entry.created_at,
        };
      }

      if (entry.activity_type === "level_up") {
        return {
          id: `activity-${entry.id}`,
          kind: "level",
          title:
            typeof metadata.level === "number"
              ? `Reached Level ${metadata.level}`
              : "Level up",
          subtitle: "Profile milestone",
          createdAt: entry.created_at,
        };
      }

      return {
        id: `activity-${entry.id}`,
        kind: "course",
        title:
          typeof metadata.course_title === "string"
            ? metadata.course_title
            : "Started a course",
        subtitle: "Course activity",
        createdAt: entry.created_at,
      };
    });

  return [...sessionItems, ...activityItems]
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
    )
    .slice(0, 4);
}

function buildNextSteps(
  skillSnapshot: DashboardSkillSnapshot,
  recentSessions: SessionScoreRow[],
  courseContinuation: DashboardCourseContinuation | null,
  isAdmin: boolean
): DashboardTask[] {
  const tasks: DashboardTask[] = [];

  if (isAdmin && courseContinuation) {
    tasks.push({
      key: "continue-course",
      href: courseContinuation.href,
      status: "live",
      progressLabel: `${courseContinuation.progressPercent}%`,
      ctaKey: "continue",
      titleKey: "continue_course",
      description: courseContinuation.title,
    });
  }

  if (skillSnapshot.weakestSkill) {
    const weakestSkill = skillSnapshot.metrics.find(
      (metric) => metric.key === skillSnapshot.weakestSkill
    );
    const targetTrack =
      skillSnapshot.weakestSkill === "delivery" ? "speaking" : "debate";

    tasks.push({
      key: "weakest-skill",
      href: `/practice?track=${targetTrack}`,
      status: "live",
      ctaKey: "practice",
      titleKey: `skill_${skillSnapshot.weakestSkill}`,
      description:
        weakestSkill && weakestSkill.value > 0
          ? `${weakestSkill.value.toFixed(1)} / 5`
          : "Focus area",
      skillKey: skillSnapshot.weakestSkill,
      track: targetTrack,
    });
  }

  const practiceCounts = recentSessions.reduce(
    (summary, session) => {
      const practiceTrack = getPracticeTrack(session.feedback);
      summary[practiceTrack] += 1;
      return summary;
    },
    { speaking: 0, debate: 0 }
  );
  const underusedTrack =
    practiceCounts.speaking < practiceCounts.debate ? "speaking" : "debate";
  tasks.push({
    key: "underused-track",
    href: `/practice?track=${underusedTrack}`,
    status: "live",
    ctaKey: "open_setup",
    titleKey: underusedTrack === "speaking" ? "start_speaking" : "start_debate",
    description:
      underusedTrack === "speaking"
        ? "Rebalance with a speaking session"
        : "Rebalance with a debate round",
    track: underusedTrack,
  });

  const latestScored = recentSessions.find((session) => session.total_score != null);
  if (latestScored) {
    tasks.push({
      key: "review-feedback",
      href: `/history/${latestScored.id}`,
      status: "live",
      ctaKey: "review",
      titleKey: "review_feedback",
      description: latestScored.topic_title,
    });
  }

  tasks.push({
    key: "live-match",
    status: "coming-soon",
    ctaKey: "coming_soon",
    titleKey: "join_live_debate",
    description: "Live debate matchmaking is on the roadmap",
  });

  return tasks.slice(0, 4);
}

export async function getDashboardData(userId: string): Promise<DashboardHomeData> {
  const supabase = await createClient();
  const weekDates = getCurrentWeekDates();
  const trailing14Dates = getTrailingDates(14);
  const today = getTodayDateString();

  const [
    profileRes,
    enrollmentsRes,
    recentSessionsRes,
    scoredSessionsRes,
    statsRes,
    activityLogRes,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, display_name, avatar_url, role, streak_current, streak_longest, streak_last_active_date, total_practice_minutes, total_sessions_completed, xp, level, onboarding_completed, preferences, orb_balance, referral_code"
      )
      .eq("id", userId)
      .single(),

    supabase
      .from("enrollments")
      .select(
        "id, course_id, status, progress_pct, courses(title, category, thumbnail_url)"
      )
      .eq("user_id", userId)
      .eq("status", "active")
      .order("progress_pct", { ascending: false })
      .limit(3),

    supabase
      .from("debate_sessions")
      .select(
        "id, topic_title, category, side, mode, feedback, total_score, overall_band, duration_seconds, created_at"
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(8),

    supabase
      .from("debate_sessions")
      .select(
        "id, topic_title, category, side, mode, feedback, total_score, overall_band, duration_seconds, created_at"
      )
      .eq("user_id", userId)
      .not("total_score", "is", null)
      .order("created_at", { ascending: false }),

    supabase
      .from("daily_stats")
      .select("date, sessions_completed, minutes_studied, xp_earned")
      .eq("user_id", userId)
      .gte("date", trailing14Dates[0])
      .lte("date", trailing14Dates[trailing14Dates.length - 1])
      .order("date"),

    supabase
      .from("activity_log")
      .select("id, activity_type, reference_id, reference_type, xp_earned, metadata, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  const profile = profileRes.data as Profile | null;
  const enrollments: EnrollmentRow[] = (enrollmentsRes.data ?? []).map((entry) => {
    const course = Array.isArray(entry.courses) ? entry.courses[0] : entry.courses;

    return {
      id: entry.id,
      course_id: entry.course_id,
      status: entry.status,
      progress_pct: entry.progress_pct,
      courses: course
        ? {
            title: course.title,
            category: course.category,
            thumbnail_url: course.thumbnail_url ?? null,
          }
        : null,
    };
  });
  const recentSessions = (recentSessionsRes.data ?? []) as SessionScoreRow[];
  const scoredSessions = (scoredSessionsRes.data ?? []) as SessionScoreRow[];
  const activityLog = (activityLogRes.data ?? []) as ActivityLogRow[];

  const statsByDate = new Map<string, DailyStatEntry>();
  for (const date of trailing14Dates) {
    statsByDate.set(date, {
      date,
      sessions_completed: 0,
      practice_minutes: 0,
      xp_earned: 0,
    });
  }

  for (const stat of statsRes.data ?? []) {
    statsByDate.set(stat.date, {
      date: stat.date,
      sessions_completed: stat.sessions_completed,
      practice_minutes: stat.minutes_studied,
      xp_earned: stat.xp_earned,
    });
  }

  const weeklyStats = weekDates.map((date) => {
    return (
      statsByDate.get(date) ?? {
        date,
        sessions_completed: 0,
        practice_minutes: 0,
        xp_earned: 0,
      }
    );
  });

  const dailyGoalMinutes = getDailyGoalMinutes(profile);
  const todayMinutes = statsByDate.get(today)?.practice_minutes ?? 0;
  const todayGoal = buildGoalSummary(todayMinutes, dailyGoalMinutes);
  const skillSnapshot = computeSkillSnapshot(scoredSessions);
  const progress = buildProgressMetrics(profile, scoredSessions, trailing14Dates, statsByDate);

  const isAdmin = profile?.role === "admin";
  const featuredEnrollment = enrollments[0];
  const courseContinuation =
    isAdmin && featuredEnrollment
      ? {
          courseId: featuredEnrollment.course_id,
          title: featuredEnrollment.courses?.title ?? "Continue course",
          category: featuredEnrollment.courses?.category ?? "debate",
          progressPercent: featuredEnrollment.progress_pct,
          href: `/dashboard/courses/${featuredEnrollment.course_id}`,
        }
      : null;

  const nav: DashboardNavItem[] = [
    { key: "dashboard", href: "/dashboard", status: "live" },
    { key: "speaking", href: "/practice?track=speaking", status: "live" },
    { key: "debate", href: "/practice?track=debate", status: "live" },
    {
      key: "courses",
      href: isAdmin ? "/courses" : undefined,
      status: isAdmin ? "live" : "coming-soon",
    },
    { key: "coach", href: "/chat?context=dashboard-home", status: "live" },
    { key: "feedback", status: "coming-soon" },
    { key: "history", href: "/history", status: "live" },
    { key: "bookmarks", status: "coming-soon" },
    { key: "analytics", status: "coming-soon" },
  ];

  const quickActions: DashboardQuickAction[] = [
    {
      key: "speaking",
      href: "/practice?track=speaking",
      status: "live",
      descriptionKey: "action_speaking_desc",
    },
    {
      key: "debate",
      href: "/practice?track=debate",
      status: "live",
      descriptionKey: "action_debate_desc",
    },
    {
      key: "course",
      href: courseContinuation?.href,
      status: courseContinuation ? "live" : "coming-soon",
      descriptionKey: courseContinuation
        ? "action_course_desc"
        : "action_course_coming_soon_desc",
    },
    {
      key: "coach",
      href: "/chat?context=dashboard-home",
      status: "live",
      descriptionKey: "action_coach_desc",
    },
  ];

  const recentActivity = buildRecentActivity(recentSessions, activityLog);
  const nextSteps = buildNextSteps(
    skillSnapshot,
    recentSessions,
    courseContinuation,
    isAdmin
  );

  return {
    profile,
    nav,
    topBar: {
      currentStreak: profile?.streak_current ?? 0,
      orbBalance: profile?.orb_balance ?? 0,
      level: profile?.level ?? 1,
      xpCurrent: profile?.xp ?? 0,
      xpGoal: getXpGoal(),
      pendingNotifications: 0,
    },
    hero: {
      weeklyStats,
      todayGoal,
    },
    skillSnapshot,
    quickActions,
    recentActivity,
    nextSteps,
    progress,
    sidebarCards: {
      dailyGoal: todayGoal,
      inviteOrbs: 3,
      referralCode: profile?.referral_code ?? null,
    },
    courseContinuation,
  };
}
