import type { PracticeTrack } from "@/types";
import {
  getPracticeFeedbackProvider,
  getProviderLabel,
  getProviderModelName,
} from "@/lib/ai/provider-selection";

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

export function getPracticeFeedbackModelProvider(track: PracticeTrack = "debate") {
  return getProviderLabel(getPracticeFeedbackProvider(track));
}

export function getPracticeFeedbackModelName(track: PracticeTrack = "debate") {
  return getProviderModelName(getPracticeFeedbackProvider(track));
}
