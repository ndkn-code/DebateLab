import { generatePracticeFeedback } from "@/lib/ai/core/legacy";
import type { PracticeFeedbackEvaluator } from "./types";

export const debatePracticeEvaluator: PracticeFeedbackEvaluator = {
  key: "debate_feedback_v1",
  evaluate(input, userId, onTelemetry) {
    return generatePracticeFeedback(
      { ...input, practiceTrack: "debate" },
      userId,
      onTelemetry
    );
  },
};
