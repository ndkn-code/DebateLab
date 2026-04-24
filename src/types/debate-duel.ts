export type DebateDuelStatus =
  | "lobby"
  | "in_progress"
  | "judging"
  | "completed"
  | "expired"
  | "cancelled";

export type DebateDuelPhase =
  | "lobby"
  | "prep"
  | "proposition-opening"
  | "opposition-opening"
  | "rebuttal-prep"
  | "proposition-rebuttal"
  | "opposition-rebuttal"
  | "judging"
  | "completed";

export type DebateDuelSide = "proposition" | "opposition";
export type DebateDuelSideAssignmentMode = "random" | "choose";
export type DebateDuelSpeechType = "opening" | "rebuttal";
export type DebateDuelTopicDifficulty = "beginner" | "intermediate" | "advanced";

export interface DebateDuelConfig {
  prepTimeSeconds: number;
  openingTimeSeconds: number;
  rebuttalTimeSeconds: number;
  entryCost: number;
}

export interface DebateDuelParticipant {
  id: string;
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: DebateDuelSide | null;
  joinedAt: string;
  readyAt: string | null;
  creditsChargedAt: string | null;
  completedAt: string | null;
}

export interface DebateDuelSpeech {
  id: string;
  participantId: string;
  roundNumber: number;
  speechType: DebateDuelSpeechType;
  side: DebateDuelSide;
  transcript: string;
  audioStoragePath: string | null;
  durationSeconds: number;
  submittedAt: string;
  metadata: Record<string, unknown>;
}

export interface DebateDuelComparativeCriterion {
  winnerSide: DebateDuelSide | "tie";
  reason: string;
}

export interface DebateDuelParticipantFeedback {
  strengths: string[];
  improvements: string[];
  summary: string;
}

export interface DebateDuelRoundBreakdown {
  roundNumber: number;
  label: string;
  winnerSide: DebateDuelSide | "tie";
  reason: string;
}

export interface DebateDuelJudgment {
  winnerSide: DebateDuelSide;
  winnerParticipantId: string | null;
  confidence: number;
  decisionSummary: string;
  comparativeBallot: {
    caseQuality: DebateDuelComparativeCriterion;
    logic: DebateDuelComparativeCriterion;
    rebuttal: DebateDuelComparativeCriterion;
    weighing: DebateDuelComparativeCriterion;
    evidence: DebateDuelComparativeCriterion;
    delivery: DebateDuelComparativeCriterion;
  };
  participantFeedback: {
    proposition: DebateDuelParticipantFeedback;
    opposition: DebateDuelParticipantFeedback;
  };
  roundBreakdown: DebateDuelRoundBreakdown[];
  summary: string;
  qualityWarnings: string[];
  model: string;
  judgedAt: string;
}

export interface DebateDuelRoomView {
  id: string;
  shareCode: string;
  topicTitle: string;
  topicCategory: string;
  topicDifficulty: DebateDuelTopicDifficulty;
  topicDescription: string | null;
  status: DebateDuelStatus;
  currentPhase: DebateDuelPhase;
  sideAssignmentMode: DebateDuelSideAssignmentMode;
  creatorSidePreference: DebateDuelSide | null;
  config: DebateDuelConfig;
  phaseStartedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  expiresAt: string;
  createdAt: string;
  creatorId: string;
  participants: DebateDuelParticipant[];
  speeches: DebateDuelSpeech[];
  judgment: DebateDuelJudgment | null;
  viewer: {
    id: string;
    isCreator: boolean;
    isParticipant: boolean;
    participantId: string | null;
    role: DebateDuelSide | null;
  };
  canJoin: boolean;
  canReady: boolean;
  canStart: boolean;
}
