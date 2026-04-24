import type { PracticeTrack } from "./feedback";
import type { SkillMetricKey } from "@/lib/analytics/skill-snapshot";

export type CoachIntentMode =
  | "general-coaching"
  | "progress-review"
  | "session-review"
  | "session-comparison"
  | "duel-review"
  | "course-help";

export interface CoachSkillMetric {
  key: SkillMetricKey;
  value: number;
  effectiveSessions: number;
  coverage: number;
}

export interface CoachTrendSummary {
  direction: "up" | "down" | "flat";
  averageScore: number | null;
  deltaFromPrevious: number | null;
  sessionsAnalyzed: number;
  summary: string;
}

export interface CoachWeaknessPattern {
  key: string;
  label: string;
  count: number;
  summary: string;
  relatedSkill: SkillMetricKey | null;
}

export interface CoachRecentSession {
  id: string;
  topicTitle: string;
  topicCategory: string | null;
  practiceTrack: PracticeTrack;
  mode: string;
  side: string;
  totalScore: number | null;
  overallBand: string | null;
  createdAt: string;
  strengths: string[];
  improvements: string[];
  summary: string;
  transcriptExcerpt?: string;
  href: string;
}

export interface CoachRecommendation {
  id: string;
  title: string;
  description: string;
  prompt: string;
  href?: string;
  track?: PracticeTrack;
  skillKey?: SkillMetricKey | null;
}

export interface CoachProfile {
  displayName: string;
  streak: number;
  level: number;
  credits: number;
  dailyGoalMinutes: number;
  sessionsLast7: number;
  sessionsLast30: number;
  minutesLast7: number;
  minutesLast30: number;
  practiceMix: {
    speaking: number;
    debate: number;
    underusedTrack: PracticeTrack;
  };
  skillSnapshot: {
    metrics: CoachSkillMetric[];
    overallScore: number | null;
    strongestSkill: SkillMetricKey | null;
    weakestSkill: SkillMetricKey | null;
    sourceSessions: number;
    confidence: number;
    trackBreakdown: Record<PracticeTrack, number>;
  };
  recentTrend: CoachTrendSummary;
  weaknessPatterns: CoachWeaknessPattern[];
  strengthPatterns: string[];
  recentSessions: CoachRecentSession[];
  bestRecentSession: CoachRecentSession | null;
  weakestRecentSession: CoachRecentSession | null;
  duelSummary: {
    totalDuels: number;
    wins: number;
    losses: number;
    recentSummary: string | null;
  };
  recommendations: CoachRecommendation[];
  starterPrompts: string[];
  brief: {
    strongestSkillLabel: string | null;
    weakestSkillLabel: string | null;
    trendSummary: string;
    nextMove: string;
  };
}

export interface CoachContextEnvelope {
  mode: CoachIntentMode;
  focusTitle: string;
  focusSummary: string;
  promptContext: string;
  starterPrompts: string[];
  selectedSession: CoachRecentSession | null;
  selectedDuel: {
    id: string;
    topicTitle: string;
    winnerSide: string | null;
    decisionSummary: string;
    participantSummary: string;
  } | null;
  selectedCourse: {
    id: string;
    title: string;
    description: string | null;
    progressPercent: number | null;
  } | null;
}
