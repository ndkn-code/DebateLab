import { analyzeDebate } from "@/lib/gemini";
import type { PracticeFeedbackEvaluator } from "./types";

export const speakingPracticeEvaluator: PracticeFeedbackEvaluator = {
  key: "speaking_feedback_v1",
  evaluate(input, userId) {
    return analyzeDebate({ ...input, practiceTrack: "speaking" }, userId);
  },
};
