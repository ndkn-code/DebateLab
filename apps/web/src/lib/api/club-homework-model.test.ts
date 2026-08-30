import assert from "node:assert/strict";
import test from "node:test";
import {
  canCreateHomeworkRevision,
  consumesHomeworkAttempt,
  sameHomeworkMime,
} from "./club-homework-model";

test("reservations do not consume attempts until finalized", () => {
  assert.equal(consumesHomeworkAttempt("draft"), false);
  assert.equal(consumesHomeworkAttempt("uploading"), false);
  assert.equal(consumesHomeworkAttempt("failed"), false);
  assert.equal(consumesHomeworkAttempt("submitted"), true);
});

test("a resubmit request permits exactly one revision", () => {
  assert.equal(canCreateHomeworkRevision({ state: "submitted", gradeStatus: "resubmit_requested", revisionNumber: 0, hasRevision: false }), true);
  assert.equal(canCreateHomeworkRevision({ state: "submitted", gradeStatus: "resubmit_requested", revisionNumber: 0, hasRevision: true }), false);
  assert.equal(canCreateHomeworkRevision({ state: "submitted", gradeStatus: "graded", revisionNumber: 0, hasRevision: false }), false);
  assert.equal(canCreateHomeworkRevision({ state: "submitted", gradeStatus: "resubmit_requested", revisionNumber: 1, hasRevision: false }), false);
});

test("MIME checks are exact and null-safe", () => {
  assert.equal(sameHomeworkMime("audio/wav", "audio/wav"), true);
  assert.equal(sameHomeworkMime("audio/wav", "audio/mpeg"), false);
  assert.equal(sameHomeworkMime(null, undefined), true);
});
