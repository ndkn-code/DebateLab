import { debatePracticeEvaluator } from "./debate";
import { speakingPracticeEvaluator } from "./speaking";
import type { PracticeFeedbackEvaluator } from "./types";
import type { PracticeAnalysisInput } from "../types";

const evaluators = {
  speaking: speakingPracticeEvaluator,
  debate: debatePracticeEvaluator,
} satisfies Record<string, PracticeFeedbackEvaluator>;

export function getPracticeFeedbackEvaluator(input: PracticeAnalysisInput) {
  return evaluators[input.practiceTrack];
}

export async function evaluatePracticeFeedback(
  input: PracticeAnalysisInput,
  userId?: string
) {
  return getPracticeFeedbackEvaluator(input).evaluate(input, userId);
}
