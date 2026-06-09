export type ShowcaseSurface = "practice" | "feedback" | "duel" | "popups";

export type ShowcaseQaStatus = "ready" | "needs-review" | "blocked";

export type ShowcaseViewport = "desktop" | "mobile" | "responsive";

export type ShowcaseSideEffectRisk =
  | "none"
  | "audio"
  | "microphone"
  | "orb-navigation"
  | "ai-network"
  | "duel-network";

export type ShowcaseScenarioId =
  | "practice-setup"
  | "audio-check-idle"
  | "audio-check-playing"
  | "audio-check-passed"
  | "mic-requesting"
  | "mic-testing"
  | "mic-denied"
  | "mic-not-found"
  | "prep"
  | "speaking-recording"
  | "speaking-paused"
  | "speaking-network-error"
  | "speaking-end-confirm"
  | "ai-rebuttal-loading"
  | "ai-rebuttal-streaming"
  | "ai-rebuttal-done"
  | "ai-rebuttal-error"
  | "transition-session-start"
  | "transition-analyzing"
  | "feedback-result"
  | "feedback-legacy"
  | "feedback-history-overall"
  | "feedback-history-transcript"
  | "feedback-history-clash"
  | "feedback-ai-verdict"
  | "feedback-unmatched-annotation"
  | "popup-feature-announcement"
  | "popup-practice-suggestion"
  | "popup-reminder-opt-in"
  | "popup-feedback-survey"
  | "popup-thank-you"
  | "duel-create"
  | "duel-matchmaking"
  | "duel-lobby"
  | "duel-live-prep"
  | "duel-live-speaking"
  | "duel-judging"
  | "duel-unavailable"
  | "duel-result-overall"
  | "duel-result-transcript"
  | "duel-result-clash"
  | "duel-result-legacy";

export interface ShowcaseScenario {
  id: ShowcaseScenarioId;
  surface: ShowcaseSurface;
  title: string;
  summary: string;
  status: ShowcaseQaStatus;
  sourceComponent: string;
  viewport: ShowcaseViewport;
  risk: ShowcaseSideEffectRisk;
  riskNotes: string;
  showcaseSafe: boolean;
  defaultTab?: "overall" | "verdict" | "transcript" | "clash";
}

export interface ShowcaseCoverageRow {
  tableName: "practice_attempts" | "analysis_jobs" | "debate_duels";
  status: string;
  count: number;
}
