import type { PracticeTrack } from "../practice";

export const PRACTICE_ANALYSIS_QUEUE_TOPIC = "practice-analysis";
export const PRACTICE_ANALYSIS_JOB_TYPE = "practice_feedback";
export const PRACTICE_AUDIO_BUCKET = "practice-audio";

export const PRACTICE_FEEDBACK_PROMPT_BUNDLE_KEY = "practice_feedback";
export const PRACTICE_FEEDBACK_PROMPT_BUNDLE_VERSION = 6;
export const PRACTICE_FEEDBACK_RUBRIC_VERSION = 3;
export const PRACTICE_FEEDBACK_MODEL_PROVIDER = "google";

export function getRubricKeyForPracticeTrack(track: PracticeTrack) {
  return track === "speaking" ? "speaking_v1" : "debate_v1";
}

export function createPracticeAnalysisIdempotencyKey(
  attemptId: string,
  promptBundleVersion = PRACTICE_FEEDBACK_PROMPT_BUNDLE_VERSION
) {
  return `practice-analysis:${attemptId}:v${promptBundleVersion}`;
}
