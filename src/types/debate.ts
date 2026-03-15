import type { DebateScore } from "./feedback";

export interface DebateTopic {
  id: string;
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

export interface DebateRound {
  roundNumber: number;
  type: "user-speech" | "ai-rebuttal";
  label: string;
  transcript?: string;
  aiResponse?: string;
  duration?: number;
}

export interface DebateSession {
  id: string;
  date: string;
  topic: DebateTopic;
  side: "proposition" | "opposition";
  mode: "quick" | "full";
  prepTime: number;
  speechTime: number;
  transcript: string;
  feedback: DebateScore | null;
  duration: number;
  prepNotes?: string;
  // Full Round fields
  aiDifficulty?: AiDifficulty;
  rounds?: DebateRound[];
}

export type { DebateScore } from "./feedback";
