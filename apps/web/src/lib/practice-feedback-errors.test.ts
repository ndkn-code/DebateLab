import assert from "node:assert/strict";
import {
  STUDENT_FEEDBACK_FAILURE_MESSAGE,
  STUDENT_FEEDBACK_TIMEOUT_MESSAGE,
  getStudentFeedbackErrorMessage,
} from "./practice-feedback-errors";

assert.equal(
  getStudentFeedbackErrorMessage(
    new Error(
      "DeepSeek returned an empty response (finish_reason=unknown, prompt_tokens=unknown)"
    )
  ),
  STUDENT_FEEDBACK_FAILURE_MESSAGE
);

assert.equal(
  getStudentFeedbackErrorMessage(
    new Error("Invalid response structure from Gemini")
  ),
  STUDENT_FEEDBACK_FAILURE_MESSAGE
);

assert.equal(
  getStudentFeedbackErrorMessage(new Error("Transcript too short (12 words).")),
  "Transcript too short (12 words)."
);

assert.equal(
  getStudentFeedbackErrorMessage(new DOMException("Aborted", "AbortError")),
  STUDENT_FEEDBACK_TIMEOUT_MESSAGE
);

console.info("practice feedback error sanitization passed");
