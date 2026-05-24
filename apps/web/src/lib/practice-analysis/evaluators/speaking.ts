import { analyzeDebate } from "@/lib/gemini";
import type { PracticeFeedbackEvaluator } from "./types";

export const speakingPracticeEvaluator: PracticeFeedbackEvaluator = {
  key: "speaking_feedback_v1",
  evaluate(input, userId, onTelemetry) {
    return analyzeDebate(
      { ...input, practiceTrack: "speaking" },
      userId,
      onTelemetry
    );
  },
};
