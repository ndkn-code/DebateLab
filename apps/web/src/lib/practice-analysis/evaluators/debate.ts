import { analyzeDebate } from "@/lib/gemini";
import type { PracticeFeedbackEvaluator } from "./types";

export const debatePracticeEvaluator: PracticeFeedbackEvaluator = {
  key: "debate_feedback_v1",
  evaluate(input, userId, onTelemetry) {
    return analyzeDebate(
      { ...input, practiceTrack: "debate" },
      userId,
      onTelemetry
    );
  },
};
