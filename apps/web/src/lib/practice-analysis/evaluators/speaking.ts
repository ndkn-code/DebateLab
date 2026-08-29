import { generatePracticeFeedback } from "@/lib/ai/core/legacy";
import type { PracticeFeedbackEvaluator } from "./types";

export const speakingPracticeEvaluator: PracticeFeedbackEvaluator = {
  key: "speaking_feedback_v1",
  evaluate(input, userId, onTelemetry) {
    return generatePracticeFeedback(
      { ...input, practiceTrack: "speaking" },
      userId,
      onTelemetry
    );
  },
};
