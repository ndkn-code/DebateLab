export type PracticeTrack = "speaking" | "debate";

export interface DebateArgumentBreakdown {
  name: string;
  summary: string;
  whatWorked: string;
  missingLayer: string;
  betterVersion: string;
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
  caseSummary?: string;
  stanceFeedback?: string;
  argumentBreakdowns?: DebateArgumentBreakdown[];
  missingLayers?: string[];
  weighingFeedback?: string;
  clashFeedback?: string;
  strongerRebuilds?: string[];
  detailedFeedback: {
    contentFeedback: string;
    structureFeedback: string;
    languageFeedback: string;
    persuasionFeedback: string;
  };
}
