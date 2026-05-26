export type PracticeTrack = "speaking" | "debate";
export type PracticeLanguage = "en" | "vi";

export interface DebateArgumentBreakdown {
  name: string;
  summary: string;
  whatWorked: string;
  missingLayer: string;
  betterVersion: string;
}

export type TranscriptAnnotationTag =
  | "stance"
  | "clarity"
  | "mechanism"
  | "evidence"
  | "logic"
  | "rebuttal"
  | "clash"
  | "weighing"
  | "impact"
  | "structure"
  | "delivery";

export type TranscriptAnnotationSeverity =
  | "strength"
  | "improvement"
  | "warning";

export type DebateReviewSpeaker = "user" | "ai";

export type DebateClashOutcome =
  | "answered"
  | "dropped"
  | "misanswered"
  | "turned"
  | "weighed";

export type DebateClashTag =
  | "clash"
  | "rebuttal"
  | "weighing"
  | "logic"
  | "evidence";

export interface TranscriptAnnotation {
  quote: string;
  roundNumber?: number;
  speaker?: DebateReviewSpeaker;
  tag: TranscriptAnnotationTag;
  severity: TranscriptAnnotationSeverity;
  feedback: string;
  suggestion: string;
}

export interface TranscriptAnnotationMetadata {
  acceptedCount: number;
  rejectedCount: number;
  repairUsed: boolean;
  fallbackUsed: boolean;
  rejectedReasons: string[];
}

export interface DebateVerdict {
  winner: "user" | "ai" | "tie";
  confidence: number;
  summary: string;
  decidingReasons: string[];
  nextMove: string;
}

export interface DebateClashLink {
  id: string;
  sourceRoundNumber: number;
  sourceSpeaker: DebateReviewSpeaker;
  responseRoundNumber: number | null;
  responseSpeaker: DebateReviewSpeaker | null;
  sourceQuote: string;
  responseQuote: string | null;
  outcome: DebateClashOutcome;
  judgeRead: string;
  suggestion: string;
  tag: DebateClashTag;
}

export interface ScoreRationaleCategory {
  score: number;
  maxScore: number;
  rationale: string;
  whyNotHigher: string;
  nextStep: string;
}

export interface ScoreRationale {
  overall: string;
  content: ScoreRationaleCategory;
  structure: ScoreRationaleCategory;
  language: ScoreRationaleCategory;
  persuasion: ScoreRationaleCategory;
}

export interface DebateScore {
  content: {
    score: number;
    claimClarity: number;
    evidenceSupport: number;
    logicCoherence: number;
    counterArgument: number;
  };
  structure: {
    score: number;
    introduction: number;
    bodyOrganization: number;
    conclusion: number;
  };
  language: {
    score: number;
    vocabulary: number;
    grammar: number;
    fluency: number;
  };
  persuasion: {
    score: number;
    audienceAwareness: number;
    impactfulness: number;
  };
  totalScore: number;
  overallBand:
    | "Novice"
    | "Developing"
    | "Competent"
    | "Proficient"
    | "Expert";
  summary: string;
  strengths: string[];
  improvements: string[];
  sampleArguments: string[];
  practiceTrack?: PracticeTrack;
  practiceLanguage?: PracticeLanguage;
  caseSummary?: string;
  stanceFeedback?: string;
  argumentBreakdowns?: DebateArgumentBreakdown[];
  missingLayers?: string[];
  weighingFeedback?: string;
  clashFeedback?: string;
  strongerRebuilds?: string[];
  transcriptAnnotations?: TranscriptAnnotation[];
  annotationMetadata?: TranscriptAnnotationMetadata;
  debateVerdict?: DebateVerdict;
  clashLinks?: DebateClashLink[];
  scoreRationale?: ScoreRationale;
  detailedFeedback: {
    contentFeedback: string;
    structureFeedback: string;
    languageFeedback: string;
    persuasionFeedback: string;
  };
}
