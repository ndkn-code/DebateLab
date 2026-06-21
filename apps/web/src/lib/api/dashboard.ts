import type { SupabaseClient } from "@supabase/supabase-js";

import { createClient } from "@/lib/supabase/server";
import {
  DASHBOARD_SKILL_ORDER,
  type DashboardSkillKey,
  DailyStatEntry,
  DashboardCourseContinuation,
  DashboardGoalSummary,
  DashboardHomeData,
  DashboardNavItem,
  DashboardProgressMetric,
  DashboardQuickAction,
  DashboardRecentItem,
  DashboardRecommendedDrill,
  DashboardSkillSnapshot,
  DashboardTodayPlanItem,
} from "@thinkfy/shared/dashboard";
import type { Profile } from "@/types/database";
import type { DebateScore, PracticeTrack } from "@/types/feedback";
import { normalizeCourseCategory } from "@/lib/courses/category";
import {
  computeSkillSnapshot as computeSharedSkillSnapshot,
  roundToTenth,
} from "@/lib/analytics/skill-snapshot";
import { LEADERBOARDS_ENABLED, areStudentCoursesEnabled } from "@/lib/features";
import { coerceSubject, type Subject } from "@thinkfy/shared/subject";
import { REFERRAL_REWARD_CREDITS } from "@/lib/referrals/constants";
import {
  DEFAULT_STREAK_TIMEZONE,
  computeEffectiveStreakState,
  normalizeStreakTimezone,
  type StreakActivityEvent,
} from "@/lib/streaks/model";

export type {
  DailyStatEntry,
  DashboardCourseContinuation,
  DashboardGoalSummary,
  DashboardHomeData,
  EnrollmentWithCourse,
  DashboardNavItem,
  DashboardProgressMetric,
  DashboardQuickAction,
  DashboardRecentItem,
  DashboardRecommendedDrill,
  DashboardSkillSnapshot,
  DashboardTodayPlanItem,
  RecentSession,
} from "@thinkfy/shared/dashboard";

const STRONG_BANDS = new Set(["Competent", "Proficient", "Expert"]);
const DAYS_IN_WEEK = 7;
const RECOMMENDED_SKILL_TARGET = 75;
const MIN_RECOMMENDATION_COVERAGE = 25;
const CLOSE_PRIORITY_WINDOW = 8;
const RECENT_FOCUS_WINDOW_DAYS = 10;

const SKILL_TRACK: Record<DashboardSkillKey, PracticeTrack> = {
  clarity: "debate",
  logic: "debate",
  rebuttal: "debate",
  evidence: "debate",
  delivery: "speaking",
};

type SessionScoreRow = {
  id: string;
  topic_title: string;
  category: string | null;
  topic_difficulty: string | null;
  side: string;
  mode: string;
  ai_difficulty: string | null;
  feedback: DebateScore | null;
  total_score: number | null;
  overall_band: string | null;
  duration_seconds: number;
  created_at: string;
};

export type DashboardImprovementSession = {
  feedback: DebateScore | null;
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

type DashboardRpcPayload = {
  profile?: unknown;
  enrollments?: unknown;
  recent_sessions?: unknown;
  scored_sessions?: unknown;
  stats?: unknown;
};

type DashboardDataOptions = {
  timezone?: string | null;
  now?: Date;
  subject?: Subject;
};

export type DashboardImprovementPriority = {
  key: DashboardSkillKey;
  score: number;
  metricValue: number;
  coverage: number;
  track: PracticeTrack;
  recentFocusCount: number;
  daysSinceTrackPractice: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

async function getDashboardPayloadFromRpc(
  supabase: SupabaseClient
): Promise<DashboardRpcPayload | null> {
  const { data, error } = await supabase.rpc("get_dashboard_payload");
  if (error || !isRecord(data)) return null;
  return data as DashboardRpcPayload;
}

function getDateFormatter(timezone = DEFAULT_STREAK_TIMEZONE) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: normalizeStreakTimezone(timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

function formatDateInZone(date: Date, timezone = DEFAULT_STREAK_TIMEZONE) {
  return getDateFormatter(timezone).format(date);
}

function getTodayDateString(now = new Date(), timezone = DEFAULT_STREAK_TIMEZONE) {
  return formatDateInZone(now, timezone);
}

function getCurrentWeekDates(now = new Date(), timezone = DEFAULT_STREAK_TIMEZONE) {
  const dates: string[] = [];
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: normalizeStreakTimezone(timezone),
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
    dates.push(formatDateInZone(current, timezone));
  }

  return dates;
}

function getTrailingDates(
  totalDays: number,
  now = new Date(),
  timezone = DEFAULT_STREAK_TIMEZONE
) {
  const dates: string[] = [];

  for (let index = totalDays - 1; index >= 0; index -= 1) {
    const current = new Date(now);
    current.setDate(now.getDate() - index);
    dates.push(formatDateInZone(current, timezone));
  }

  return dates;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function readFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getPracticeTrack(feedback: DebateScore | null): PracticeTrack {
  return feedback?.practiceTrack === "speaking" ? "speaking" : "debate";
}

function isStrongBand(band: string | null | undefined) {
  return band ? STRONG_BANDS.has(band) : false;
}

function getDailyGoalMinutes(profile: Pick<Profile, "preferences"> | null) {
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

function getWeeklyGoalMinutes(profile: Pick<Profile, "preferences"> | null) {
  const preferences = (profile?.preferences as Record<string, unknown> | null) ?? {};
  const explicitWeeklyGoal = preferences.weekly_goal_minutes;
  if (typeof explicitWeeklyGoal === "number" && explicitWeeklyGoal > 0) {
    return explicitWeeklyGoal;
  }

  const explicitDailyGoal = preferences.daily_goal_minutes;
  if (typeof explicitDailyGoal === "number" && explicitDailyGoal > 0) {
    return explicitDailyGoal * DAYS_IN_WEEK;
  }

  const onboardingGoal = preferences.dailyCommitment;
  if (typeof onboardingGoal === "number" && onboardingGoal > 0) {
    return onboardingGoal * DAYS_IN_WEEK;
  }

  return 100;
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
  return roundToTenth(average);
}

function buildGoalSummary(
  practicedMinutes: number,
  goalMinutes: number
): DashboardGoalSummary {
  const safeGoal = goalMinutes > 0 ? goalMinutes : 30;

  return {
    goalMinutes: safeGoal,
    practicedMinutes,
    remainingMinutes: Math.max(safeGoal - practicedMinutes, 0),
    progressPercent: Math.round(clamp((practicedMinutes / safeGoal) * 100, 0, 100)),
    metGoal: practicedMinutes >= safeGoal,
  };
}

export function buildWeeklyGoalSummary(
  profile: Pick<Profile, "preferences"> | null,
  weeklyStats: DailyStatEntry[]
): DashboardGoalSummary {
  const practicedMinutes = weeklyStats.reduce(
    (sum, entry) => sum + entry.practice_minutes,
    0
  );

  return buildGoalSummary(practicedMinutes, getWeeklyGoalMinutes(profile));
}

function computeSkillSnapshot(scoredSessions: SessionScoreRow[]): DashboardSkillSnapshot {
  return computeSharedSkillSnapshot(scoredSessions) as DashboardSkillSnapshot;
}

function normalizeFeedbackScore(value: unknown, max: number) {
  const numeric = readFiniteNumber(value);
  if (numeric == null || max <= 0) return null;
  return roundToTenth((numeric / max) * 100);
}

function getFeedbackSkillScores(feedback: DebateScore | null) {
  if (!feedback) return {};

  const deliveryValues = [
    normalizeFeedbackScore(feedback.language?.vocabulary, 8),
    normalizeFeedbackScore(feedback.language?.grammar, 9),
    normalizeFeedbackScore(feedback.language?.fluency, 8),
  ].filter((value): value is number => value != null);

  return {
    clarity: normalizeFeedbackScore(feedback.content?.claimClarity, 10),
    logic: normalizeFeedbackScore(feedback.content?.logicCoherence, 10),
    rebuttal: normalizeFeedbackScore(feedback.content?.counterArgument, 10),
    evidence: normalizeFeedbackScore(feedback.content?.evidenceSupport, 10),
    delivery:
      deliveryValues.length > 0
        ? roundToTenth(
            deliveryValues.reduce((sum, value) => sum + value, 0) /
              deliveryValues.length
          )
        : null,
  } satisfies Partial<Record<DashboardSkillKey, number | null>>;
}

function getSessionTimestamp(session: DashboardImprovementSession) {
  const timestamp = new Date(session.created_at).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function getDaysSince(timestamp: number | null, now: number) {
  if (timestamp == null) return null;
  return Math.max(0, (now - timestamp) / (1000 * 60 * 60 * 24));
}

function getSessionLowestSkill(session: DashboardImprovementSession) {
  const scores = getFeedbackSkillScores(session.feedback);
  const candidates = DASHBOARD_SKILL_ORDER.flatMap((key) => {
    const value = scores[key];
    return value == null ? [] : [{ key, value }];
  });

  if (candidates.length === 0) return null;

  return candidates.sort((left, right) => left.value - right.value)[0]?.key ?? null;
}

function getRecentFocusCounts(
  sessions: DashboardImprovementSession[],
  now: number
) {
  const counts = DASHBOARD_SKILL_ORDER.reduce(
    (summary, key) => {
      summary[key] = 0;
      return summary;
    },
    {} as Record<DashboardSkillKey, number>
  );

  for (const session of sessions) {
    const daysSince = getDaysSince(getSessionTimestamp(session), now);
    if (daysSince == null || daysSince > RECENT_FOCUS_WINDOW_DAYS) continue;

    const lowestSkill = getSessionLowestSkill(session);
    if (lowestSkill) counts[lowestSkill] += 1;
  }

  return counts;
}

function getDaysSinceTrackPractice(
  skill: DashboardSkillKey,
  sessions: DashboardImprovementSession[],
  now: number
) {
  const targetTrack = SKILL_TRACK[skill];
  let latestTimestamp: number | null = null;

  for (const session of sessions) {
    if (getPracticeTrack(session.feedback) !== targetTrack) continue;

    const scores = getFeedbackSkillScores(session.feedback);
    if (scores[skill] == null) continue;

    const timestamp = getSessionTimestamp(session);
    if (timestamp != null && (latestTimestamp == null || timestamp > latestTimestamp)) {
      latestTimestamp = timestamp;
    }
  }

  return getDaysSince(latestTimestamp, now);
}

function scoreImprovementPriority(params: {
  metricValue: number;
  coverage: number;
  recentFocusCount: number;
  daysSinceTrackPractice: number | null;
  weeklyGoal: DashboardGoalSummary;
}) {
  const weaknessGap = Math.max(RECOMMENDED_SKILL_TARGET - params.metricValue, 0);
  const coverageConfidence =
    params.coverage >= MIN_RECOMMENDATION_COVERAGE
      ? 1
      : clamp(params.coverage / MIN_RECOMMENDATION_COVERAGE, 0.2, 0.72);
  const recencyBonus =
    params.daysSinceTrackPractice == null
      ? 6
      : params.daysSinceTrackPractice >= 14
        ? 8
        : params.daysSinceTrackPractice >= 7
          ? 5
          : params.daysSinceTrackPractice >= 3
            ? 2
            : 0;
  const weeklyGoalBoost = params.weeklyGoal.metGoal
    ? 0
    : clamp((100 - params.weeklyGoal.progressPercent) / 12, 0, 8);
  const repeatPenalty =
    params.recentFocusCount >= 2 ? Math.min(params.recentFocusCount * 4, 12) : 0;

  return roundToTenth(
    weaknessGap * 1.5 * coverageConfidence +
      recencyBonus +
      weeklyGoalBoost -
      repeatPenalty
  );
}

export function selectDashboardImprovementSkill(
  skillSnapshot: DashboardSkillSnapshot,
  scoredSessions: DashboardImprovementSession[],
  weeklyGoal: DashboardGoalSummary,
  now = Date.now()
): DashboardImprovementPriority | null {
  const supportedMetrics = skillSnapshot.metrics.filter(
    (metric) => metric.coverage >= MIN_RECOMMENDATION_COVERAGE
  );
  const candidateMetrics =
    supportedMetrics.length > 0
      ? supportedMetrics
      : skillSnapshot.metrics.filter((metric) => metric.coverage > 0);

  if (candidateMetrics.length === 0) return null;

  const recentFocusCounts = getRecentFocusCounts(scoredSessions, now);
  const priorities = candidateMetrics
    .map((metric) => {
      const daysSinceTrackPractice = getDaysSinceTrackPractice(
        metric.key,
        scoredSessions,
        now
      );
      const score = scoreImprovementPriority({
        metricValue: metric.value,
        coverage: metric.coverage,
        recentFocusCount: recentFocusCounts[metric.key],
        daysSinceTrackPractice,
        weeklyGoal,
      });

      return {
        key: metric.key,
        score,
        metricValue: metric.value,
        coverage: metric.coverage,
        track: SKILL_TRACK[metric.key],
        recentFocusCount: recentFocusCounts[metric.key],
        daysSinceTrackPractice,
      } satisfies DashboardImprovementPriority;
    })
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.metricValue - right.metricValue;
    });

  const topPriority = priorities[0];
  if (!topPriority) return null;

  const closeAlternative = priorities.find(
    (priority) =>
      priority.key !== topPriority.key &&
      topPriority.recentFocusCount >= 2 &&
      topPriority.score - priority.score <= CLOSE_PRIORITY_WINDOW &&
      priority.metricValue < RECOMMENDED_SKILL_TARGET
  );

  return closeAlternative ?? topPriority;
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
      displayValue: `${Math.round(currentAverageScore)} /100`,
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
  recentSessions: SessionScoreRow[]
): DashboardRecentItem[] {
  return recentSessions.slice(0, 4).map((session) => {
    const practiceTrack = getPracticeTrack(session.feedback);
    return {
      id: `session-${session.id}`,
      kind: practiceTrack,
      title: session.topic_title,
      subtitle: practiceTrack === "speaking" ? "Speaking Practice" : "Debate Practice",
      createdAt: session.created_at,
      href: `/history/${session.id}`,
      scoreOutOf100: session.total_score != null ? Math.round(session.total_score) : null,
      statusLabel: session.overall_band,
      progressPercent: null,
    };
  });
}

function getUnderusedTrack(recentSessions: SessionScoreRow[]): PracticeTrack {
  const practiceCounts = recentSessions.reduce(
    (summary, session) => {
      const practiceTrack = getPracticeTrack(session.feedback);
      summary[practiceTrack] += 1;
      return summary;
    },
    { speaking: 0, debate: 0 }
  );

  return practiceCounts.speaking < practiceCounts.debate ? "speaking" : "debate";
}

function buildCoursePlanItem(
  courseContinuation: DashboardCourseContinuation | null
): DashboardTodayPlanItem | null {
  if (!courseContinuation) return null;

  return {
    id: "continue-course",
    key: "continue-course",
    href: courseContinuation.href,
    detailHref: courseContinuation.href,
    ctaKey: "continue",
    durationMinutes: 12,
    context: courseContinuation.title,
    progressLabel: `${courseContinuation.progressPercent}%`,
  };
}

function buildImprovementSkillPlanItem(
  skillSnapshot: DashboardSkillSnapshot,
  scoredSessions: DashboardImprovementSession[],
  weeklyGoal: DashboardGoalSummary
): DashboardTodayPlanItem | null {
  const improvementSkill = selectDashboardImprovementSkill(
    skillSnapshot,
    scoredSessions,
    weeklyGoal
  );
  if (!improvementSkill) return null;

  if (improvementSkill.metricValue >= RECOMMENDED_SKILL_TARGET) {
    return null;
  }

  return {
    id: `improve-${improvementSkill.key}`,
    key: "weakest-skill",
    href: `/practice?track=${improvementSkill.track}`,
    detailHref: "/profile",
    ctaKey: "start",
    durationMinutes: 10,
    context: null,
    scoreOutOf100: Math.round(improvementSkill.metricValue),
    skillKey: improvementSkill.key,
    track: improvementSkill.track,
  };
}

function buildReviewPlanItem(
  recentSessions: SessionScoreRow[]
): DashboardTodayPlanItem | null {
  const latestScored = recentSessions.find((session) => session.total_score != null);
  if (!latestScored) return null;

  return {
    id: `review-${latestScored.id}`,
    key: "review-feedback",
    href: `/history/${latestScored.id}`,
    detailHref: `/history/${latestScored.id}`,
    ctaKey: "review",
    durationMinutes: 7,
    context: latestScored.topic_title,
    scoreOutOf100:
      latestScored.total_score != null ? Math.round(latestScored.total_score) : null,
    track: getPracticeTrack(latestScored.feedback),
  };
}

function buildUnderusedPlanItem(
  recentSessions: SessionScoreRow[]
): DashboardTodayPlanItem {
  const track = getUnderusedTrack(recentSessions);

  return {
    id: `underused-${track}`,
    key: "underused-track",
    href: `/practice?track=${track}`,
    detailHref: "/practice",
    ctaKey: "start",
    durationMinutes: 10,
    context: null,
    track,
  };
}

function buildStarterPlanItem(track: PracticeTrack): DashboardTodayPlanItem {
  return {
    id: `start-${track}`,
    key: track === "speaking" ? "start-speaking" : "start-debate",
    href: `/practice?track=${track}`,
    detailHref: "/practice",
    ctaKey: "start",
    durationMinutes: 10,
    context: null,
    track,
  };
}

function buildCoachPlanItem(): DashboardTodayPlanItem {
  return {
    id: "coach-check",
    key: "coach-check",
    href: "/chat?context=coach-home",
    detailHref: "/chat?context=coach-home",
    ctaKey: "ask-coach",
    durationMinutes: 5,
    context: null,
  };
}

function buildDashboardPlan(
  skillSnapshot: DashboardSkillSnapshot,
  recentSessions: SessionScoreRow[],
  courseContinuation: DashboardCourseContinuation | null,
  weeklyGoal: DashboardGoalSummary,
  scoredSessions: DashboardImprovementSession[]
): {
  recommendedDrill: DashboardRecommendedDrill;
  todayPlanItems: DashboardTodayPlanItem[];
} {
  const improvementSkillPlan = buildImprovementSkillPlanItem(
    skillSnapshot,
    scoredSessions,
    weeklyGoal
  );
  const coursePlan = buildCoursePlanItem(courseContinuation);
  const reviewPlan = buildReviewPlanItem(recentSessions);
  const underusedPlan = buildUnderusedPlanItem(recentSessions);

  const recommendedDrill =
    improvementSkillPlan ?? coursePlan ?? reviewPlan ?? underusedPlan;

  const candidateItems = [
    coursePlan,
    reviewPlan,
    improvementSkillPlan,
    underusedPlan,
    buildStarterPlanItem("speaking"),
    buildStarterPlanItem("debate"),
    buildCoachPlanItem(),
  ].filter((item): item is DashboardTodayPlanItem => Boolean(item));

  const seen = new Set<string>();
  const todayPlanItems = candidateItems.filter((item) => {
    const signature = `${item.key}:${item.href}`;
    const duplicatesHero =
      item.key === recommendedDrill.key && item.href === recommendedDrill.href;
    if (duplicatesHero || seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });

  return {
    recommendedDrill,
    todayPlanItems: todayPlanItems.slice(0, 3),
  };
}

export async function getDashboardData(
  userId: string,
  authenticatedClient?: SupabaseClient,
  options: DashboardDataOptions = {}
): Promise<DashboardHomeData> {
  const supabase = authenticatedClient ?? (await createClient());
  const subject = coerceSubject(options.subject);
  const now = options.now ?? new Date();
  const timezone = normalizeStreakTimezone(options.timezone);
  const weekDates = getCurrentWeekDates(now, timezone);
  const trailing14Dates = getTrailingDates(14, now, timezone);
  const today = getTodayDateString(now, timezone);
  const skillSnapshotStartDate = new Date(now);
  skillSnapshotStartDate.setDate(skillSnapshotStartDate.getDate() - 29);
  skillSnapshotStartDate.setHours(0, 0, 0, 0);
  const skillSnapshotStartIso = skillSnapshotStartDate.toISOString();

  const rpcPayload = await getDashboardPayloadFromRpc(supabase);
  const fallbackPayload = rpcPayload
    ? null
    : await Promise.all([
        supabase
          .from("profiles")
          .select(
            "id, display_name, avatar_url, handle, profile_status, role, streak_current, streak_longest, streak_last_active_date, total_practice_minutes, total_sessions_completed, xp, level, onboarding_completed, preferences, orb_balance, referral_code"
          )
          .eq("id", userId)
          .single(),

        supabase
          .from("enrollments")
          .select("*, courses(title, category, thumbnail_url)")
          .eq("user_id", userId)
          .eq("status", "active"),

        supabase
          .from("debate_sessions")
          .select(
            "id, topic_title, category:topic_category, topic_difficulty, side, mode, ai_difficulty, feedback, total_score, overall_band, duration_seconds, created_at"
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(8),

        supabase
          .from("debate_sessions")
          .select(
            "id, topic_title, category:topic_category, topic_difficulty, side, mode, ai_difficulty, feedback, total_score, overall_band, duration_seconds, created_at"
          )
          .eq("user_id", userId)
          .not("total_score", "is", null)
          .gte("created_at", skillSnapshotStartIso)
          .order("created_at", { ascending: false }),

        supabase
          .from("daily_stats")
          .select("date, sessions_completed, minutes_studied, xp_earned")
          .eq("user_id", userId)
          .gte("date", trailing14Dates[0])
          .lte("date", trailing14Dates[trailing14Dates.length - 1])
          .order("date"),
      ]);
  const streakActivitiesRes = await supabase
    .from("activity_log")
    .select("activity_type, reference_type, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(500);

  const profile = (rpcPayload?.profile ??
    fallbackPayload?.[0].data) as Profile | null;
  const streakActivities = streakActivitiesRes.error
    ? undefined
    : ((streakActivitiesRes.data ?? []) as StreakActivityEvent[]);
  const effectiveStreak = computeEffectiveStreakState({
    profile: profile ?? {},
    activities: streakActivities,
    timezone,
    now,
  });
  const isAdmin = profile?.role === "admin";
  const enrollmentRows = rpcPayload
    ? asArray(rpcPayload.enrollments)
    : fallbackPayload?.[1].data ?? [];
  const enrollments: EnrollmentRow[] = (enrollmentRows as Array<{
    id: string;
    course_id: string;
    status: string;
    progress_percent?: number;
    progress_pct?: number;
    courses?: { title?: string; category?: string; thumbnail_url?: string | null } | Array<{ title?: string; category?: string; thumbnail_url?: string | null }> | null;
  }>)
    .map((entry) => {
      const course = Array.isArray(entry.courses) ? entry.courses[0] : entry.courses;
      const progressPercent =
        typeof entry.progress_percent === "number"
          ? entry.progress_percent
          : typeof entry.progress_pct === "number"
            ? entry.progress_pct
            : 0;

      return {
        id: entry.id,
        course_id: entry.course_id,
        status: entry.status,
        progress_pct: progressPercent,
        courses: course
          ? {
              title: course.title ?? "Course",
              category: normalizeCourseCategory(course.category),
              thumbnail_url: course.thumbnail_url ?? null,
            }
          : null,
      };
    })
    .sort(
      (left, right) =>
        right.progress_pct - left.progress_pct ||
        (left.courses?.title ?? "").localeCompare(right.courses?.title ?? "")
    );
  const recentSessions = (rpcPayload
    ? asArray(rpcPayload.recent_sessions)
    : fallbackPayload?.[2].data ?? []) as SessionScoreRow[];
  const scoredSessions = (rpcPayload
    ? asArray(rpcPayload.scored_sessions)
    : fallbackPayload?.[3].data ?? []) as SessionScoreRow[];

  const statsByDate = new Map<string, DailyStatEntry>();
  for (const date of trailing14Dates) {
    statsByDate.set(date, {
      date,
      sessions_completed: 0,
      practice_minutes: 0,
      xp_earned: 0,
    });
  }

  const statRows = rpcPayload
    ? asArray(rpcPayload.stats)
    : fallbackPayload?.[4].data ?? [];
  for (const stat of statRows as Array<{
    date: string;
    sessions_completed: number;
    minutes_studied: number;
    xp_earned: number;
  }>) {
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
  const weeklyGoal = buildWeeklyGoalSummary(profile, weeklyStats);
  const skillSnapshot = computeSkillSnapshot(scoredSessions);
  const progress = buildProgressMetrics(profile, scoredSessions, trailing14Dates, statsByDate);

  // Scope the "continue learning" card to the active subject. Debate keeps the
  // engine gated off (null, unchanged); IELTS has no content yet, so this stays
  // null until WS-1.x. `coerceSubject` treats a missing course subject as debate.
  const featuredEnrollment = areStudentCoursesEnabled(subject)
    ? (enrollments.find(
        (enrollment) =>
          coerceSubject(
            (enrollment.courses as { subject?: string | null } | null)?.subject
          ) === subject
      ) ?? null)
    : null;
  const courseContinuation =
    featuredEnrollment
      ? {
          courseId: featuredEnrollment.course_id,
          title: featuredEnrollment.courses?.title ?? "Continue course",
          category: featuredEnrollment.courses?.category ?? "debate",
          progressPercent: featuredEnrollment.progress_pct,
          href: "/courses",
        }
      : null;

  const nav: DashboardNavItem[] = [
    { key: "dashboard", href: "/dashboard", status: "live" },
    { key: "practice", href: "/practice", status: "live" },
    {
      key: "leaderboards",
      href: LEADERBOARDS_ENABLED ? "/leaderboards" : undefined,
      status: LEADERBOARDS_ENABLED ? "live" : "coming-soon",
    },
    {
      key: "duel",
      href: isAdmin ? "/debates" : undefined,
      status: isAdmin ? "live" : "coming-soon",
    },
    ...(areStudentCoursesEnabled(subject)
      ? ([
          {
            key: "courses",
            href: "/courses",
            status: "live",
          },
        ] satisfies DashboardNavItem[])
      : []),
    { key: "coach", href: "/chat?context=coach-home", status: "live" },
    { key: "analytics", href: "/profile", status: "live" },
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
    ...(areStudentCoursesEnabled(subject)
      ? ([
          {
            key: "course",
            href: "/courses",
            status: "live",
            descriptionKey: courseContinuation
              ? "action_course_desc"
              : "action_course_browse_desc",
          },
        ] satisfies DashboardQuickAction[])
      : []),
    {
      key: "coach",
      href: "/chat?context=coach-home",
      status: "live",
      descriptionKey: "action_coach_desc",
    },
  ];

  const recentActivity = buildRecentActivity(recentSessions);
  const { recommendedDrill, todayPlanItems } = buildDashboardPlan(
    skillSnapshot,
    recentSessions,
    courseContinuation,
    weeklyGoal,
    scoredSessions
  );

  return {
    profile,
    nav,
    topBar: {
      currentStreak: effectiveStreak.current,
      orbBalance: profile?.orb_balance ?? 0,
      level: profile?.level ?? 1,
      xpCurrent: profile?.xp ?? 0,
      xpGoal: getXpGoal(),
      pendingNotifications: 0,
    },
    hero: {
      weeklyStats,
      todayGoal,
      weeklyGoal,
    },
    skillSnapshot,
    recommendedDrill,
    quickActions,
    recentActivity,
    todayPlanItems,
    progress,
    sidebarCards: {
      dailyGoal: todayGoal,
      inviteOrbs: REFERRAL_REWARD_CREDITS,
      referralCode: profile?.referral_code ?? null,
    },
    courseContinuation,
  };
}
