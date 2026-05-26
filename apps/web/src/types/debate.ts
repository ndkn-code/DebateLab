import type { DebateScore, PracticeLanguage, PracticeTrack } from "./feedback";
import type { PracticeTranscriptionArtifact } from "@thinkfy/shared/practice";

export interface DebateTopic {
  id: string;
  topicKey?: string;
  categoryKey?: string;
  title: string;
  category: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  displayOrder?: number;
  sourceKind?: "legacy" | "calico" | "truong_teen";
  sourceLanguage?: PracticeLanguage;
  sourceCount?: number;
  sourceTags?: string[];
  tournamentNames?: string[];
  hasInfoSlide?: boolean;
  hasStats?: boolean;
  metadata?: Record<string, unknown>;
  ragReady?: boolean;
  aiConfidence?: number;
  aggregateConfidence?: number;
  priorityTier?: "truong_teen" | "rag_ready" | "high_confidence" | "standard";
  context?: string;
  motionBrief?: MotionBrief;
  suggestedPoints?: {
    proposition: string[];
    opposition: string[];
  };
}

export type AiDifficulty = "easy" | "medium" | "hard";
export type { PracticeLanguage, PracticeTrack } from "./feedback";

export interface MotionBrief {
  keyTerms: string[];
  scope: string;
  propositionBurden: string;
  oppositionBurden: string;
  modelClarification: string;
}

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
  debateMemory?: DebateMemory;
}

export interface DebateMemory {
  aiSide: "proposition" | "opposition";
  studentSide: "proposition" | "opposition";
  policyModel: string;
  priorAiClaims: string[];
  concessions: string[];
  activeClashes: string[];
  droppedClaims: string[];
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
  transcription?: PracticeTranscriptionArtifact | null;
  // Full Round fields
  aiDifficulty?: AiDifficulty;
  rounds?: DebateRound[];
  debateMemory?: DebateMemory | null;
}

export type { DebateScore } from "./feedback";
