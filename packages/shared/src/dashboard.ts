import type { PracticeTrack } from "./practice/feedback";

export type DashboardNavKey =
  | "dashboard"
  | "practice"
  | "leaderboards"
  | "duel"
  | "courses"
  | "coach"
  | "history"
  | "analytics"
  // IELTS learner shell (WS-5.1) — only surfaced when the active subject is
  // `ielts`; debate nav never includes these.
  | "ielts_home"
  | "ielts_library";

export type DashboardActionKey = "speaking" | "debate" | "course" | "coach";

export type DashboardSkillKey =
  | "clarity"
  | "logic"
  | "rebuttal"
  | "evidence"
  | "delivery";

export const DASHBOARD_SKILL_ORDER: DashboardSkillKey[] = [
  "clarity",
  "logic",
  "rebuttal",
  "evidence",
  "delivery",
];

export type DashboardTopicDifficulty = "beginner" | "intermediate" | "advanced";

export type DashboardAiDifficulty = "easy" | "medium" | "hard";

export type DashboardPlanKey =
  | "continue-course"
  | "weakest-skill"
  | "underused-track"
  | "review-feedback"
  | "start-speaking"
  | "start-debate"
  | "coach-check";

export type DashboardPlanCtaKey = "start" | "continue" | "review" | "ask-coach";

export type DashboardRecentKind =
  | "speaking"
  | "debate"
  | "course"
  | "lesson"
  | "level"
  | "streak";

export type DashboardMetricKey =
  | "total-sessions"
  | "strong-rate"
  | "average-score"
  | "practice-time";

export interface DashboardProfileSummary {
  id: string;
  email: string | null;
  display_name: string;
  avatar_url: string | null;
  role: "student" | "teacher" | "admin";
  streak_current: number;
  streak_longest: number;
  streak_last_active_date: string | null;
  total_practice_minutes: number;
  total_sessions_completed: number;
  xp: number;
  level: number;
  onboarding_completed: boolean;
  preferences: Record<string, unknown>;
  selected_title: string | null;
  unlocked_titles: string[];
  banner_color: string;
  referral_code: string | null;
  orb_balance: number;
  referred_by: string | null;
  created_at: string;
  updated_at: string;
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
  practice_track: PracticeTrack;
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

export interface DashboardNavItem {
  key: DashboardNavKey;
  href?: string;
  status: "live" | "coming-soon";
}

export interface DashboardSkillMetric {
  key: DashboardSkillKey;
  rawValue: number | null;
  challengeAdjustedValue: number | null;
  value: number;
  effectiveSessions: number;
  coverage: number;
}

export interface DashboardSkillSnapshot {
  metrics: DashboardSkillMetric[];
  overallScore: number | null;
  weakestSkill: DashboardSkillKey | null;
  strongestSkill: DashboardSkillKey | null;
  sourceSessions: number;
  confidence: number;
  trackBreakdown: Record<PracticeTrack, number>;
  difficultyBreakdown: {
    topic: Record<DashboardTopicDifficulty, number>;
    ai: Record<DashboardAiDifficulty | "none", number>;
  };
}

export interface DashboardQuickAction {
  key: DashboardActionKey;
  href?: string;
  status: "live" | "coming-soon";
  descriptionKey: string;
}

export interface DashboardRecommendedDrill {
  key: DashboardPlanKey;
  href: string;
  detailHref?: string;
  ctaKey: DashboardPlanCtaKey;
  durationMinutes: number;
  context: string | null;
  progressLabel?: string;
  scoreOutOf100?: number | null;
  skillKey?: DashboardSkillKey;
  track?: PracticeTrack;
}

export interface DashboardTodayPlanItem extends DashboardRecommendedDrill {
  id: string;
}

export interface DashboardRecentItem {
  id: string;
  kind: DashboardRecentKind;
  title: string;
  subtitle: string;
  createdAt: string;
  href?: string;
  scoreOutOf100?: number | null;
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
  remainingMinutes: number;
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
  profile: DashboardProfileSummary | null;
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
    weeklyGoal: DashboardGoalSummary;
  };
  skillSnapshot: DashboardSkillSnapshot;
  recommendedDrill: DashboardRecommendedDrill;
  quickActions: DashboardQuickAction[];
  recentActivity: DashboardRecentItem[];
  todayPlanItems: DashboardTodayPlanItem[];
  progress: DashboardProgressMetric[];
  sidebarCards: {
    dailyGoal: DashboardGoalSummary;
    inviteOrbs: number;
    referralCode: string | null;
  };
  courseContinuation: DashboardCourseContinuation | null;
}
