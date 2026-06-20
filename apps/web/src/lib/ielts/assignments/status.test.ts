import assert from "node:assert/strict";
import {
  deriveLearnerAssignmentProgress,
  summarizeAssignmentCompletion,
  type AttemptSummary,
  type MemberAssignmentProgress,
} from "./status";

const attempt = (p: Partial<AttemptSummary>): AttemptSummary => ({
  id: "a1",
  status: "in_progress",
  startedAt: "2026-06-01T00:00:00.000Z",
  overallBand: null,
  ...p,
});

// ---- deriveLearnerAssignmentProgress --------------------------------------

// No attempts -> not started, nothing to link.
assert.deepEqual(deriveLearnerAssignmentProgress([]), {
  state: "not_started",
  resultAttemptId: null,
  overallBand: null,
});

// Only an in-progress sitting.
assert.deepEqual(
  deriveLearnerAssignmentProgress([attempt({ id: "x", status: "in_progress" })]),
  { state: "in_progress", resultAttemptId: null, overallBand: null },
);

// Submitted (awaiting/while scoring) surfaces as "submitted" + links the attempt.
assert.deepEqual(
  deriveLearnerAssignmentProgress([
    attempt({ id: "s", status: "submitted", overallBand: 6.5 }),
  ]),
  { state: "submitted", resultAttemptId: "s", overallBand: 6.5 },
);
assert.equal(
  deriveLearnerAssignmentProgress([attempt({ id: "g", status: "scoring" })]).state,
  "submitted",
);

// Completed wins; the latest terminal attempt is the one linked.
const completed = deriveLearnerAssignmentProgress([
  attempt({ id: "old", status: "completed", startedAt: "2026-06-01T00:00:00.000Z", overallBand: 6 }),
  attempt({ id: "new", status: "completed", startedAt: "2026-06-05T00:00:00.000Z", overallBand: 7 }),
]);
assert.deepEqual(completed, { state: "completed", resultAttemptId: "new", overallBand: 7 });

// A finished sitting outranks a newer in-progress re-sit, but a completed one is
// still preferred over a bare submit when it is the most recent terminal row.
const mixed = deriveLearnerAssignmentProgress([
  attempt({ id: "done", status: "completed", startedAt: "2026-06-02T00:00:00.000Z", overallBand: 7.5 }),
  attempt({ id: "retry", status: "in_progress", startedAt: "2026-06-09T00:00:00.000Z" }),
]);
assert.deepEqual(mixed, { state: "completed", resultAttemptId: "done", overallBand: 7.5 });

// Expired/abandoned only -> treated as not started (re-sittable).
assert.equal(
  deriveLearnerAssignmentProgress([
    attempt({ id: "e", status: "expired" }),
    attempt({ id: "ab", status: "abandoned" }),
  ]).state,
  "not_started",
);

// ---- summarizeAssignmentCompletion ----------------------------------------

const member = (p: Partial<MemberAssignmentProgress>): MemberAssignmentProgress => ({
  userId: "u",
  state: "not_started",
  overallBand: null,
  ...p,
});

assert.deepEqual(summarizeAssignmentCompletion([]), {
  total: 0,
  notStarted: 0,
  inProgress: 0,
  submitted: 0,
  completed: 0,
  averageBand: null,
});

const summary = summarizeAssignmentCompletion([
  member({ userId: "a", state: "completed", overallBand: 7 }),
  member({ userId: "b", state: "completed", overallBand: 6 }),
  member({ userId: "c", state: "submitted", overallBand: null }),
  member({ userId: "d", state: "in_progress" }),
  member({ userId: "e", state: "not_started" }),
]);
assert.deepEqual(summary, {
  total: 5,
  notStarted: 1,
  inProgress: 1,
  submitted: 1,
  completed: 2,
  averageBand: 6.5,
});

// Average rounds to one decimal across only the banded members.
assert.equal(
  summarizeAssignmentCompletion([
    member({ state: "completed", overallBand: 6 }),
    member({ state: "completed", overallBand: 6.5 }),
    member({ state: "completed", overallBand: 7 }),
  ]).averageBand,
  6.5,
);
assert.equal(
  summarizeAssignmentCompletion([
    member({ state: "completed", overallBand: 5.5 }),
    member({ state: "completed", overallBand: 6 }),
  ]).averageBand,
  5.8,
);

console.log("ielts/assignments/status tests passed");
