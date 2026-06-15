import assert from "node:assert/strict";
import {
  getPracticeFeedbackProvider,
  getPracticeJudgeFallbackProvider,
} from "./provider-selection";

const originalFeedbackProvider = process.env.DEBATE_AI_FEEDBACK_PROVIDER;
const originalSpeakingProvider = process.env.SPEAKING_AI_FEEDBACK_PROVIDER;
const originalFallbackProvider = process.env.PRACTICE_JUDGE_FALLBACK_PROVIDER;

try {
  process.env.DEBATE_AI_FEEDBACK_PROVIDER = "deepseek";
  process.env.SPEAKING_AI_FEEDBACK_PROVIDER = "deepseek";
  assert.equal(getPracticeFeedbackProvider("debate"), "gemini");
  assert.equal(getPracticeFeedbackProvider("speaking"), "gemini");

  delete process.env.PRACTICE_JUDGE_FALLBACK_PROVIDER;
  assert.equal(getPracticeJudgeFallbackProvider(), "deepseek");

  process.env.PRACTICE_JUDGE_FALLBACK_PROVIDER = "none";
  assert.equal(getPracticeJudgeFallbackProvider(), "none");

  process.env.PRACTICE_JUDGE_FALLBACK_PROVIDER = "false";
  assert.equal(getPracticeJudgeFallbackProvider(), "none");

  process.env.PRACTICE_JUDGE_FALLBACK_PROVIDER = "deepseek";
  assert.equal(getPracticeJudgeFallbackProvider(), "deepseek");
} finally {
  if (originalFeedbackProvider == null) {
    delete process.env.DEBATE_AI_FEEDBACK_PROVIDER;
  } else {
    process.env.DEBATE_AI_FEEDBACK_PROVIDER = originalFeedbackProvider;
  }
  if (originalSpeakingProvider == null) {
    delete process.env.SPEAKING_AI_FEEDBACK_PROVIDER;
  } else {
    process.env.SPEAKING_AI_FEEDBACK_PROVIDER = originalSpeakingProvider;
  }
  if (originalFallbackProvider == null) {
    delete process.env.PRACTICE_JUDGE_FALLBACK_PROVIDER;
  } else {
    process.env.PRACTICE_JUDGE_FALLBACK_PROVIDER = originalFallbackProvider;
  }
}

console.info("practice judge provider selection passed");
