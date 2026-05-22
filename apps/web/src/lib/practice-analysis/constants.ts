export {
  createPracticeAnalysisIdempotencyKey,
  getRubricKeyForPracticeTrack,
  PRACTICE_ANALYSIS_JOB_TYPE,
  PRACTICE_ANALYSIS_QUEUE_TOPIC,
  PRACTICE_AUDIO_BUCKET,
  PRACTICE_FEEDBACK_MODEL_PROVIDER,
  PRACTICE_FEEDBACK_PROMPT_BUNDLE_KEY,
  PRACTICE_FEEDBACK_PROMPT_BUNDLE_VERSION,
  PRACTICE_FEEDBACK_RUBRIC_VERSION,
} from "@thinkfy/shared/practice-analysis";

export function getPracticeFeedbackModelName() {
  return process.env.GEMINI_MODEL || "gemini-2.5-flash";
}
