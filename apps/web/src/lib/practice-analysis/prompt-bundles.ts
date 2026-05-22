import { buildAnalysisPrompt } from "@/lib/prompts";
import {
  PRACTICE_FEEDBACK_PROMPT_BUNDLE_KEY,
  PRACTICE_FEEDBACK_PROMPT_BUNDLE_VERSION,
  PRACTICE_FEEDBACK_RUBRIC_VERSION,
  getRubricKeyForPracticeTrack,
} from "./constants";
import { createPromptHash } from "./snapshot";
import type { PracticeAnalysisInput } from "./types";

export const PRACTICE_FEEDBACK_PROMPT_BUNDLE = {
  key: PRACTICE_FEEDBACK_PROMPT_BUNDLE_KEY,
  version: PRACTICE_FEEDBACK_PROMPT_BUNDLE_VERSION,
  evaluators: {
    speaking: "speaking_feedback_v1",
    debate: "debate_feedback_v1",
  },
} as const;

export function getPracticeFeedbackPromptManifest(input: PracticeAnalysisInput) {
  const prompt = buildAnalysisPrompt(input);
  return {
    prompt,
    promptHash: createPromptHash(prompt),
    promptBundleKey: PRACTICE_FEEDBACK_PROMPT_BUNDLE.key,
    promptBundleVersion: PRACTICE_FEEDBACK_PROMPT_BUNDLE.version,
    rubricKey: getRubricKeyForPracticeTrack(input.practiceTrack),
    rubricVersion: PRACTICE_FEEDBACK_RUBRIC_VERSION,
    evaluatorKey: PRACTICE_FEEDBACK_PROMPT_BUNDLE.evaluators[input.practiceTrack],
  };
}
