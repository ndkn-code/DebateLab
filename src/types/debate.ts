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
}

export type { DebateScore } from "./feedback";
