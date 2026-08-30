import assert from "node:assert/strict";
import test from "node:test";
import { buildIeltsReviewQueue } from "./review-queue-contract";
import type { IeltsClassGradebook } from "./gradebook-repository";

test("unifies ordinary homework and current IELTS response reviews deterministically", () => {
  const gradebook = {
    classId: "class-1",
    clubId: "club-1",
    rows: [{
      userId: "student-1", displayName: "Learner", assignments: [{
        assignmentId: "assignment-1", title: "Weekly writing", dueAt: null,
        submittedAt: "2026-08-29T11:00:00Z",
        homework: { submissionId: "submission-1", submitted: true, status: "submitted", gradeStatus: "submitted", submittedAt: "2026-08-29T10:00:00Z", score: null, scoreMax: null },
        reviewTargets: [{ responseKind: "writing", responseId: "response-1", revision: 1, attemptId: "attempt-1", assignmentId: "assignment-1", currentReviewStatus: "draft" }],
      }],
    }],
  } as unknown as IeltsClassGradebook;
  const queue = buildIeltsReviewQueue(gradebook);
  assert.deepEqual(queue.map((item) => item.key), [
    "homework:submission-1",
    "writing:response-1:1",
  ]);
  assert.equal(queue[1].state, "draft");
});

test("published response reviews and graded homework leave the queue", () => {
  const gradebook = {
    classId: "class-1", clubId: "club-1", rows: [{
      userId: "student-1", displayName: "Learner", assignments: [{
        assignmentId: "assignment-1", title: "Work", dueAt: null, submittedAt: null,
        homework: { submissionId: "submission-1", submitted: true, status: "submitted", gradeStatus: "graded", submittedAt: null, score: 8, scoreMax: 9 },
        reviewTargets: [{ responseKind: "speaking", responseId: "response-1", revision: 0, attemptId: "attempt-1", assignmentId: "assignment-1", currentReviewStatus: "published" }],
      }],
    }],
  } as unknown as IeltsClassGradebook;
  assert.deepEqual(buildIeltsReviewQueue(gradebook), []);
});
