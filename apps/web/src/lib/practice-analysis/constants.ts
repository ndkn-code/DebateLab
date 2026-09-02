import type { PracticeTrack } from "@/types";
import { getAiTaskPolicy } from "@/lib/ai/core/policies";

export {
  createPracticeAnalysisIdempotencyKey,
  getRubricKeyForPracticeTrack,
  PRACTICE_ANALYSIS_JOB_TYPE,
  PRACTICE_ANALYSIS_QUEUE_TOPIC,
  PRACTICE_AUDIO_BUCKET,
  PRACTICE_FEEDBACK_PROMPT_BUNDLE_KEY,
  PRACTICE_FEEDBACK_PROMPT_BUNDLE_VERSION,
  PRACTICE_FEEDBACK_RUBRIC_VERSION,
} from "@thinkfy/shared/practice-analysis";

export function getPracticeFeedbackModelProvider(
  track: PracticeTrack = "debate",
) {
  void track;
  const provider = getAiTaskPolicy("practice_judging").candidates[0]?.provider;
  return provider === "gemini" ? "google" : (provider ?? "unknown");
}

export function getPracticeFeedbackModelName(track: PracticeTrack = "debate") {
  void track;
  return (
    getAiTaskPolicy("practice_judging").candidates[0]?.model ?? "unconfigured"
  );
}
