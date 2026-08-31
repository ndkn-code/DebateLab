import assert from "node:assert/strict";
import test from "node:test";
import { buildTeacherReviewQueue } from "./teacher-review-queue-contract";

const base = {
  class_id: "class-1",
  club_id: "club-1",
  class_title: "Foundation",
  program_type: "ielts",
  user_id: "student-1",
  student_name: "Learner",
  assignment_id: "assignment-1",
  assignment_title: "Writing task",
  due_at: "2026-08-28T12:00:00Z",
};

test("combines ordinary homework and current IELTS response work in stable order", () => {
  const items = buildTeacherReviewQueue({
    now: "2026-08-31T12:00:00Z",
    homework: [
      {
        ...base,
        id: "submission-1",
        kind: "homework",
        submitted_at: "2026-08-29T12:00:00Z",
        submission_state: "submitted",
        grade_status: "submitted",
      },
    ],
    responses: [
      {
        ...base,
        id: "response-1",
        kind: "writing",
        attempt_id: "attempt-1",
        revision: 2,
        submitted_at: "2026-08-30T12:00:00Z",
      },
    ],
    reviews: [],
  });
  assert.deepEqual(
    items.map((item) => item.key),
    ["homework:submission-1", "writing:response-1:2"],
  );
  assert.equal(items[0]?.scoreSource, "none");
  assert.equal(items[1]?.scoreSource, "ai_provisional");
  assert.equal(items[0]?.ageDays, 2);
});

test("uses only the current response revision and excludes published teacher authority", () => {
  const items = buildTeacherReviewQueue({
    now: "2026-08-31T12:00:00Z",
    homework: [],
    responses: [
      {
        ...base,
        id: "old-response",
        kind: "writing",
        attempt_id: "attempt-1",
        revision: 1,
        submitted_at: "2026-08-28T12:00:00Z",
      },
      {
        ...base,
        id: "current-response",
        kind: "writing",
        attempt_id: "attempt-1",
        revision: 2,
        submitted_at: "2026-08-30T12:00:00Z",
      },
    ],
    reviews: [
      {
        id: "published",
        response_id: "current-response",
        revision: 2,
        status: "published",
        updated_at: "2026-08-30T11:00:00Z",
      },
      {
        id: "newer-draft",
        response_id: "current-response",
        revision: 2,
        status: "draft",
        updated_at: "2026-08-31T12:00:00Z",
      },
    ],
  });
  assert.deepEqual(items, []);
});

test("keeps returned and draft work visible with explicit status", () => {
  const items = buildTeacherReviewQueue({
    homework: [
      {
        ...base,
        id: "returned",
        kind: "homework",
        submitted_at: "2026-08-30T12:00:00Z",
        submission_state: "submitted",
        grade_status: "returned",
      },
      {
        ...base,
        id: "graded",
        kind: "homework",
        submitted_at: "2026-08-30T12:00:00Z",
        submission_state: "submitted",
        grade_status: "graded",
      },
    ],
    responses: [
      {
        ...base,
        id: "draft-response",
        kind: "speaking",
        attempt_id: "attempt-2",
        revision: 1,
        submitted_at: "2026-08-30T12:00:00Z",
      },
    ],
    reviews: [
      {
        id: "draft",
        response_id: "draft-response",
        revision: 1,
        status: "draft",
        updated_at: "2026-08-30T12:00:00Z",
      },
    ],
  });
  assert.deepEqual(
    items.map((item) => [item.key, item.status]),
    [
      ["homework:returned", "returned"],
      ["speaking:draft-response:1", "draft"],
    ],
  );
});

test("excludes pending and failed AI responses before teacher review", () => {
  const items = buildTeacherReviewQueue({
    now: "2026-08-31T12:00:00Z",
    homework: [],
    reviews: [],
    responses: [
      {
        ...base,
        id: "pending",
        kind: "writing",
        attempt_id: "attempt-3",
        revision: 0,
        submitted_at: "2026-08-30T12:00:00Z",
        status: "pending",
      },
      {
        ...base,
        id: "failed",
        kind: "writing",
        attempt_id: "attempt-4",
        revision: 0,
        submitted_at: "2026-08-30T12:00:00Z",
        status: "failed",
      },
      {
        ...base,
        id: "scored",
        kind: "writing",
        attempt_id: "attempt-5",
        revision: 0,
        submitted_at: "2026-08-30T12:00:00Z",
        status: "scored",
      },
    ],
  });
  assert.deepEqual(
    items.map((item) => item.responseId),
    ["scored"],
  );
});
