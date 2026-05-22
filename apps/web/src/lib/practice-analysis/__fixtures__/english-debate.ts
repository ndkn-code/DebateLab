import type { DebateScore } from "@/types/feedback";
import type { PracticeAnalysisInput } from "../types";

export const englishDebateInput: PracticeAnalysisInput = {
  transcript:
    "We should ban phones in school because students need deep focus. Phones interrupt lessons, reduce attention, and make teachers spend time managing distractions instead of teaching. The opposition may say phones help research, but schools can provide controlled devices when research is actually needed.",
  topic: "Schools should ban phones during class time",
  side: "proposition",
  speechType: "Quick Debate Practice",
  timeLimit: 2,
  actualDuration: 87,
  practiceTrack: "debate",
  practiceLanguage: "en",
  isFullRound: false,
  mode: "quick",
  prepTime: 120,
  speechTime: 120,
  prepNotes: "Focus on classroom attention.",
  topicCategory: "Education",
  topicCategoryKey: "education",
  topicDifficulty: "beginner",
};

export const englishDebateFeedback: DebateScore = {
  content: {
    claimClarity: 8,
    evidenceSupport: 6,
    logicCoherence: 7,
    counterArgument: 7,
    score: 28,
  },
  structure: {
    introduction: 7,
    bodyOrganization: 7,
    conclusion: 5,
    score: 19,
  },
  language: {
    vocabulary: 7,
    grammar: 8,
    fluency: 7,
    score: 22,
  },
  persuasion: {
    audienceAwareness: 4,
    impactfulness: 4,
    score: 8,
  },
  totalScore: 77,
  overallBand: "Proficient",
  summary: "The case is clear and easy to follow.",
  strengths: ["Clear stance", "Useful counterargument", "Good classroom impact"],
  improvements: ["Add stronger evidence", "Compare impacts", "End with weighing"],
  sampleArguments: ["A stronger version would compare learning time against convenience."],
  practiceTrack: "debate",
  practiceLanguage: "en",
  detailedFeedback: {
    contentFeedback: "The main claim is clear.",
    structureFeedback: "The speech has a simple progression.",
    languageFeedback: "The language is direct.",
    persuasionFeedback: "The impact needs more weighing.",
  },
};
