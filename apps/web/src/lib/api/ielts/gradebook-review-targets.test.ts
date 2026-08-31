import assert from "node:assert/strict";
import type { IeltsGradebookReviewTarget } from "./gradebook-repository";
import { isCurrentResponseRevision } from "./gradebook-contract";

const target: IeltsGradebookReviewTarget = {
  responseKind: "writing",
  responseId: "00000000-0000-0000-0000-000000000001",
  revision: 1,
  taskNumber: 2,
  partNumber: null,
  attemptId: "00000000-0000-0000-0000-000000000002",
  assignmentId: "00000000-0000-0000-0000-000000000003",
  currentReviewId: "00000000-0000-0000-0000-000000000004",
  currentReviewStatus: "draft",
  currentReviewNote: "Focus on task development.",
  currentReview: {
    id: "00000000-0000-0000-0000-000000000004",
    status: "draft",
    note: "Focus on task development.",
  },
  scoringStatus: "failed",
  manualRetryAvailable: true,
  media: null,
  criteria: [
    {
      key: "taskResponse",
      labelEn: "Task Response",
      labelVi: "Trả lời yêu cầu đề",
      aiBand: 6,
      teacherBand: null,
      effectiveBand: 6,
      reviewStatus: "draft",
      rationale: "Addresses the prompt.",
    },
  ],
};

assert.equal(target.responseKind, "writing");
assert.equal(target.criteria[0]?.labelEn, "Task Response");
assert.equal(target.currentReview?.id, target.currentReviewId);
assert.equal(target.manualRetryAvailable, true);
assert.equal(isCurrentResponseRevision(target.revision, 1), true);
assert.equal(isCurrentResponseRevision(target.revision, 0), false);
assert.equal(target.assignmentId.length, 36);
console.log("IELTS gradebook review target contract tests passed");
