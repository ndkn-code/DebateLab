export const STUDENT_FEEDBACK_FAILURE_MESSAGE =
  "AI feedback failed. Please try again.";

export const STUDENT_FEEDBACK_TIMEOUT_MESSAGE =
  "Analysis is taking longer than expected. Your transcript is safe, so please try again in a moment.";

const SAFE_ERROR_PATTERNS = [
  /^Please sign in again/i,
  /^Missing session transcript/i,
  /^Transcript too short/i,
  /^Too many requests/i,
  /^Could not load analysis status/i,
  /^Received invalid response from server/i,
  /^Server error \(\d+\)$/i,
  /^We saved your transcript/i,
  /^Something went wrong/i,
  /^Analysis is taking longer than expected/i,
];

const PROVIDER_ERROR_PATTERNS = [
  /deepseek/i,
  /gemini/i,
  /googlegenerativeai/i,
  /provider/i,
  /api key/i,
  /finish_reason/i,
  /prompt_tokens/i,
  /completion_tokens/i,
  /reasoning_chars/i,
  /empty response/i,
  /malformed json/i,
  /invalid response structure/i,
  /analysis_failed/i,
  /timeout/i,
  /quota/i,
  /rate.?limit/i,
  /service unavailable/i,
  /resource_exhausted/i,
];

export function getStudentFeedbackErrorMessage(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return STUDENT_FEEDBACK_TIMEOUT_MESSAGE;
  }

  const message = error instanceof Error ? error.message : String(error ?? "");
  if (!message) {
    return STUDENT_FEEDBACK_FAILURE_MESSAGE;
  }

  if (SAFE_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
    return message;
  }

  if (PROVIDER_ERROR_PATTERNS.some((pattern) => pattern.test(message))) {
    return STUDENT_FEEDBACK_FAILURE_MESSAGE;
  }

  return STUDENT_FEEDBACK_FAILURE_MESSAGE;
}
