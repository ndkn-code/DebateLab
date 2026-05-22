import type { DebateScore, PracticeLanguage, PracticeTrack } from "./feedback";

export interface DebateTopic {
  id: string;
  topicKey?: string;
  categoryKey?: string;
  title: string;
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  context?: string;
  suggestedPoints?: {
    proposition: string[];
    opposition: string[];
  };
}

export type AiDifficulty = "easy" | "medium" | "hard";

export type AiHighlightType = "claim" | "evidence" | "impact" | "assumption";

export interface AiHighlight {
  type: AiHighlightType;
  quote: string;
  note?: string;
}

export interface DebateRound {
  roundNumber: number;
  type: "user-speech" | "ai-rebuttal";
  label: string;
  transcript?: string;
  aiResponse?: string;
  aiHighlights?: AiHighlight[];
  duration?: number;
}

export interface ClubPracticeContext {
  clubId?: string;
  classId?: string;
  assignmentId?: string;
  assignmentTitle?: string;
}

export interface DebateSession {
  id: string;
  date: string;
  topic: DebateTopic;
  side: "proposition" | "opposition";
  practiceTrack: PracticeTrack;
  practiceLanguage: PracticeLanguage;
  mode: "quick" | "full";
  prepTime: number;
  speechTime: number;
  transcript: string;
  feedback: DebateScore | null;
  duration: number;
  prepNotes?: string;
  clubContext?: ClubPracticeContext;
  modelName?: string | null;
  aiDifficulty?: AiDifficulty;
  rounds?: DebateRound[];
}
