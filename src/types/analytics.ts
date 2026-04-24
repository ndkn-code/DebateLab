import type { SkillMetricKey } from "@/lib/analytics/skill-snapshot";
import type { DebateDuelSide } from "./debate-duel";
import type { PracticeTrack } from "./debate";

export type AnalyticsRangePreset = "7d" | "30d" | "90d";

export interface AnalyticsHero {
  displayName: string;
  avatarUrl: string | null;
  title: string | null;
  level: number;
  xp: number;
  xpInLevel: number;
  xpToNextLevel: number;
  xpProgressPercent: number;
  statusLine: string;
  streak: number;
  totalSessions: number;
  totalPracticeMinutes: number;
}

export interface AnalyticsSkillMetric {
  key: SkillMetricKey;
  value: number;
}

export interface AnalyticsSkillSnapshot {
  metrics: AnalyticsSkillMetric[];
  overallScore: number | null;
  strongestSkill: SkillMetricKey | null;
  weakestSkill: SkillMetricKey | null;
  sourceSessions: number;
  note: string;
}

export interface AnalyticsTrendPoint {
  label: string;
  value: number;
}

export type AnalyticsInsightCard =
  | {
      key: "practice-minutes";
      totalMinutes: number;
      deltaPercent: number | null;
      series: AnalyticsTrendPoint[];
    }
  | {
      key: "speaking-vs-debate";
      speakingCount: number;
      debateCount: number;
      speakingPercent: number;
      debatePercent: number;
    }
  | {
      key: "recent-average-score";
      averageScore: number | null;
      deltaPoints: number | null;
      sessionsAnalyzed: number;
      series: AnalyticsTrendPoint[];
    }
  | {
      key: "strongest-focus";
      strongestSkill: SkillMetricKey | null;
      strongestScore: number | null;
      focusSkill: SkillMetricKey | null;
      focusScore: number | null;
    };

export interface AnalyticsRecentSession {
  id: string;
  kind: "practice" | "duel";
  topicTitle: string;
  topicCategory: string | null;
  practiceTrack: PracticeTrack;
  mode: string;
  side: DebateDuelSide | null;
  score: number | null;
  resultLabel: string | null;
  confidencePercent: number | null;
  durationMinutes: number | null;
  createdAt: string;
  href: string;
}

export interface AnalyticsPageData {
  range: AnalyticsRangePreset;
  hero: AnalyticsHero;
  skillSnapshot: AnalyticsSkillSnapshot;
  insights: AnalyticsInsightCard[];
  recentSessions: AnalyticsRecentSession[];
}
