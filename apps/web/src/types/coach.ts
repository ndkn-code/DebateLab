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
  rawValue: number;
  challengeAdjustedValue: number;
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
    difficultyBreakdown: {
      topic: Record<"beginner" | "intermediate" | "advanced", number>;
      ai: Record<"easy" | "medium" | "hard" | "none", number>;
    };
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

export type CoachResponseBlockType =
  | "opening_formula"
  | "template"
  | "diagnosis"
  | "coach_tip"
  | "common_mistake"
  | "example"
  | "drill"
  | "next_steps"
  | "clarifying_question";

export interface CoachResponseBlock {
  id: string;
  type: CoachResponseBlockType;
  title: string;
  body?: string;
  items?: string[];
  prompt?: string;
}

export interface CoachSuggestedAction {
  label: string;
  prompt: string;
  variant?: "primary" | "secondary";
}

export type CoachRouteIntent =
  | "general"
  | "corpus_debate_help"
  | "deep_review"
  | "visual_explainer";

export type CoachModelRoute =
  | "groq_general"
  | "groq_corpus"
  | "gemini_deep_review"
  | "visual_explainer";

export type CoachVisualTemplate =
  | "argument_chain"
  | "rebuttal_pivot"
  | "clash_map"
  | "weighing_scale";

export interface CoachVisualStep {
  id: string;
  label: string;
  text: string;
  accent?: "primary" | "warning" | "success" | "danger";
}

export interface CoachVisualConnector {
  from: string;
  to: string;
  label?: string;
}

export interface CoachVisualExplainerSpec {
  version: 1;
  template: CoachVisualTemplate;
  title: string;
  subtitle?: string;
  steps: CoachVisualStep[];
  connectors?: CoachVisualConnector[];
  takeaway?: string;
  sourceMessageId?: string;
  plannerModel?: string;
}

export interface CoachMessageMetadata {
  renderVersion: 1;
  summary?: string;
  blocks: CoachResponseBlock[];
  suggestedActions: CoachSuggestedAction[];
  visualizable?: boolean;
  visualPrompt?: string;
  visualExplainer?: CoachVisualExplainerSpec | null;
  coachIntent?: CoachRouteIntent;
  coachModelRoute?: CoachModelRoute;
  coachCorpusRetrievedCount?: number;
  coachCorpusCandidateCount?: number;
  corpusRetrievalLogId?: string | null;
  visualTemplate?: CoachVisualTemplate;
  visualPlannerModel?: string;
  firstTokenLatencyMs?: number | null;
}
