import assert from "node:assert/strict";
import { resolveTeacherAwareAttemptBands } from "./effective-bands";

const review = {
  review_kind: "writing" as const,
  writing_response_id: "task-2",
  speaking_response_id: null,
  revision: 0,
  task_band: 7.5,
  skill_band: null,
};

const single = resolveTeacherAwareAttemptBands({
  ai: { writing_band: 8 },
  reviews: [review],
  writingResponses: [
    { id: "task-2", task_number: 2, revision: 0, task_band: 8 },
  ],
  speakingResponses: [],
});
assert.equal(single.bands.writing, 7.5);
assert.equal(single.source, "mixed");

const mixedFullTest = resolveTeacherAwareAttemptBands({
  ai: { writing_band: 7.5 },
  reviews: [review],
  writingResponses: [
    { id: "task-1", task_number: 1, revision: 0, task_band: 6.5 },
    { id: "task-2", task_number: 2, revision: 0, task_band: 8 },
  ],
  speakingResponses: [],
});
assert.equal(mixedFullTest.bands.writing, 7);
assert.equal(mixedFullTest.source, "mixed");

const staleReview = resolveTeacherAwareAttemptBands({
  ai: { writing_band: 8 },
  reviews: [review],
  writingResponses: [
    { id: "task-2", task_number: 2, revision: 1, task_band: 8 },
  ],
  speakingResponses: [],
});
assert.equal(staleReview.bands.writing, 8);
assert.equal(staleReview.source, "ai");

console.log("ielts/teacher/effective-bands tests passed");
