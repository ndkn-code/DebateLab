export type CoachPracticeLanguage = "en" | "vi";
export type CoachPracticeTrack = "speaking" | "debate";

export type CoachIntentMode =
  | "general-coaching"
  | "progress-review"
  | "session-review"
  | "session-comparison"
  | "duel-review"
  | "course-help";

export type CoachSkillMetricKey =
  | "clarity"
  | "logic"
  | "rebuttal"
  | "evidence"
  | "delivery";

export interface CoachSkillMetric {
  key: CoachSkillMetricKey;
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
  relatedSkill: CoachSkillMetricKey | null;
}

export interface CoachRecentSession {
  id: string;
  topicTitle: string;
  topicCategory: string | null;
  practiceTrack: CoachPracticeTrack;
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
  track?: CoachPracticeTrack;
  skillKey?: CoachSkillMetricKey | null;
}

export interface CoachProfileSummary {
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
    underusedTrack: CoachPracticeTrack;
  };
  skillSnapshot: {
    metrics: CoachSkillMetric[];
    overallScore: number | null;
    strongestSkill: CoachSkillMetricKey | null;
    weakestSkill: CoachSkillMetricKey | null;
    sourceSessions: number;
    confidence: number;
  };
  recentTrend: CoachTrendSummary;
  weaknessPatterns: CoachWeaknessPattern[];
  strengthPatterns: string[];
  recentSessions: CoachRecentSession[];
  recommendations: CoachRecommendation[];
  starterPrompts: string[];
  brief: {
    strongestSkillLabel: string | null;
    weakestSkillLabel: string | null;
    trendSummary: string;
    nextMove: string;
  };
}

export interface CoachContextEnvelopeSummary {
  mode: CoachIntentMode;
  focusTitle: string;
  focusSummary: string;
  starterPrompts: string[];
  selectedSession: CoachRecentSession | null;
}

export type CoachResponseBlockType =
  | "opening_formula"
  | "template"
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

export interface CoachMessageMetadata {
  renderVersion: 1;
  summary?: string;
  blocks: CoachResponseBlock[];
  suggestedActions: CoachSuggestedAction[];
}

export interface MobileCoachConversationSummary {
  id: string;
  title: string;
  contextType: string | null;
  contextId: string | null;
  preview: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MobileCoachMessage {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  metadata: CoachMessageMetadata | null;
  createdAt: string;
}

export interface MobileCoachHomeResponse {
  ok: true;
  profile: CoachProfileSummary;
  envelope: CoachContextEnvelopeSummary;
  conversations: MobileCoachConversationSummary[];
}

export interface MobileCoachConversationResponse {
  ok: true;
  conversation: MobileCoachConversationSummary;
  messages: MobileCoachMessage[];
}

export interface MobileCoachSendMessageRequest {
  message: string;
  conversationId?: string | null;
  context?: string | null;
  contextId?: string | null;
  practiceLanguage?: CoachPracticeLanguage;
}

export interface MobileCoachSendMessageResponse {
  ok: true;
  conversation: MobileCoachConversationSummary;
  userMessage: MobileCoachMessage;
  assistantMessage: MobileCoachMessage;
  envelope: CoachContextEnvelopeSummary;
  finishReason: string | null;
}
