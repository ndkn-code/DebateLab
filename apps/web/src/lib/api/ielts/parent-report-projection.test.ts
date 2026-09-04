import assert from "node:assert/strict";
import { projectParentReportAttempt } from "./gradebook-repository";
import { projectParentReportScoreSource } from "./effective-score-contract";
import type { TeacherReviewRow } from "./teacher-review-repository";

const bands = {
  listening_band: 7,
  reading_band: 7,
  writing_band: 6.5,
  speaking_band: 6.5,
  overall_band: 7,
};
const review = (overrides: Partial<TeacherReviewRow>): TeacherReviewRow => ({
  id: "review",
  attempt_id: "attempt",
  user_id: "student",
  club_id: "club",
  class_id: "class",
  assignment_id: "assignment",
  writing_response_id: "response",
  speaking_response_id: null,
  review_kind: "writing",
  rubric_key: "ielts",
  rubric_version: 1,
  revision: 2,
  status: "published",
  task_number: 2,
  part_number: null,
  task_response_band: 8,
  coherence_cohesion_band: 8,
  lexical_resource_band: 8,
  grammar_band: 8,
  fluency_coherence_band: null,
  pronunciation_band: null,
  task_band: 8,
  skill_band: 8,
  reviewer_id: "teacher",
  reviewer_note: null,
  returned_note: null,
  revision_granted: null,
  revision_consumed_at: null,
  published_at: "2026-08-20T00:00:00Z",
  returned_at: null,
  created_at: "2026-08-20T00:00:00Z",
  updated_at: "2026-08-20T00:00:00Z",
  ...overrides,
});

const partial = projectParentReportAttempt({
  attemptId: "attempt",
  assignmentId: "assignment",
  effective: {
    listening_band: 7,
    reading_band: 7,
    writing_band: null,
    speaking_band: null,
    overall_band: 7,
  },
  writing: [],
  speaking: [],
  reviews: [],
});
assert.equal(partial.score.overall, null);
assert.equal(partial.score.overallIsProvisional, true);

const flagged = projectParentReportAttempt({
  attemptId: "attempt",
  assignmentId: "assignment",
  effective: { ...bands, overall_is_provisional: true },
  writing: [],
  speaking: [],
  reviews: [],
});
assert.equal(flagged.score.overall, null);
assert.equal(flagged.score.overallIsProvisional, true);

const projected = projectParentReportAttempt({
  attemptId: "attempt",
  assignmentId: "assignment",
  effective: { ...bands, overall_is_provisional: false, score_source: "mixed" },
  writing: [
    {
      id: "response",
      attempt_id: "attempt",
      task_number: 2,
      revision: 2,
      task_response_band: 6,
    },
  ],
  speaking: [],
  reviews: [review({})],
});
assert.equal(projected.source, "mixed");
assert.equal(
  projected.reviewTargets[0]?.criteria.find(
    (criterion) => criterion.key === "taskResponse",
  )?.effectiveBand,
  8,
);

for (const status of ["draft", "returned"] as const) {
  const result = projectParentReportAttempt({
    attemptId: "attempt",
    assignmentId: "assignment",
    ai: { writing_band: 6 },
    writing: [
      {
        id: "response",
        attempt_id: "attempt",
        task_number: 2,
        revision: 2,
        task_response_band: 6,
      },
    ],
    speaking: [],
    reviews: [review({ status })],
  });
  assert.equal(
    result.reviewTargets[0]?.criteria.find(
      (criterion) => criterion.key === "taskResponse",
    )?.effectiveBand,
    6,
  );
}
const stale = projectParentReportAttempt({
  attemptId: "attempt",
  assignmentId: "assignment",
  ai: { writing_band: 6 },
  writing: [
    {
      id: "response",
      attempt_id: "attempt",
      task_number: 2,
      revision: 3,
      task_response_band: 6,
    },
  ],
  speaking: [],
  reviews: [review({ revision: 2 })],
});
assert.equal(
  stale.reviewTargets[0]?.criteria.find(
    (criterion) => criterion.key === "taskResponse",
  )?.reviewStatus,
  "none",
);
assert.equal(projectParentReportScoreSource(undefined, undefined), "none");
assert.equal(
  projectParentReportScoreSource(
    { score_source: "mixed" },
    { writing_band: 6 },
  ),
  "mixed",
);
console.log("parent report projection tests passed");
