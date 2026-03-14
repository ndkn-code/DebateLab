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
  detailedFeedback: {
    contentFeedback: string;
    structureFeedback: string;
    languageFeedback: string;
    persuasionFeedback: string;
  };
}
