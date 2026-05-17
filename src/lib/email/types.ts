export const EMAIL_TEMPLATE_KEYS = [
  "welcome",
  "onboarding_nudge",
  "practice_reminder",
  "streak_rescue",
  "winback",
  "weekly_progress",
  "achievement",
  "course_nudge",
  "club_invitation",
] as const;

export type EmailTemplateKey = (typeof EMAIL_TEMPLATE_KEYS)[number];
export type EmailLocale = "vi" | "en";
export type EmailCategory =
  | "onboarding"
  | "practice"
  | "streak"
  | "progress"
  | "achievement"
  | "course"
  | "system";

export type EmailStatus =
  | "queued"
  | "skipped"
  | "sent"
  | "scheduled"
  | "delivered"
  | "opened"
  | "clicked"
  | "bounced"
  | "complained"
  | "failed"
  | "suppressed";

export interface EmailStreakDot {
  date: string;
  label: string;
  active: boolean;
  today: boolean;
}

export interface EmailStreakState {
  current: number;
  profileCurrent: number;
  lastActiveDate: string | null;
  profileLastActiveDate: string | null;
  activeToday: boolean;
  atRiskToday: boolean;
  activeDatesLast7: string[];
  dots: EmailStreakDot[];
  timezone: string;
  mismatch: boolean;
}

export interface EmailProfile {
  id: string;
  email: string | null;
  display_name: string | null;
  onboarding_completed: boolean;
  preferences: Record<string, unknown> | null;
  streak_current: number;
  streak_last_active_date: string | null;
  total_sessions_completed: number;
  total_practice_minutes: number;
  xp: number;
  level: number;
  created_at: string;
}

export interface EmailActivitySummary {
  lastActivityAt: string | null;
  lastPracticeAt: string | null;
  lastLessonAt: string | null;
  lastCourseStartedAt: string | null;
  sessionsLast7Days: number;
  minutesLast7Days: number;
  xpLast7Days: number;
  bestScoreLast7Days: number | null;
  latestCourseTitle: string | null;
  latestAchievementLabel: string | null;
  latestAchievementKey?: string | null;
  streakState?: EmailStreakState | null;
}

export interface EmailCandidate {
  userId: string;
  toEmail: string;
  templateKey: EmailTemplateKey;
  category: EmailCategory;
  locale: EmailLocale;
  sendKey: string;
  subject: string;
  variables: EmailTemplateVariables;
  metadata?: Record<string, unknown>;
}

export interface EmailTemplateVariables {
  locale?: EmailLocale;
  userName: string;
  appUrl: string;
  settingsUrl: string;
  ctaUrl: string;
  ctaLabel: string;
  headline: string;
  body: string;
  preheader: string;
  mascotMood: "welcome" | "nudge" | "warning" | "winback" | "celebrate";
  badgeLabel?: string;
  heroAlt?: string;
  progressLabel?: string;
  progressPercent?: number;
  stat1Label?: string;
  stat1Value?: string;
  stat2Label?: string;
  stat2Value?: string;
  stat3Label?: string;
  stat3Value?: string;
  streakDots?: EmailStreakDot[];
  unsubscribeUrl?: string;
  oneClickUnsubscribeUrl?: string;
  supportEmail?: string;
  secondaryNote?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

export interface EmailDispatchResult {
  candidateUsers: number;
  queued: number;
  sent: number;
  skipped: number;
  failed: number;
  dryRun: boolean;
  errors: string[];
}
