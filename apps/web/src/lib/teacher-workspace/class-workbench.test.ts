import assert from "node:assert/strict";
import test from "node:test";

import {
  buildClassGradebook,
  type GradebookSubmissionRow,
} from "./class-gradebook-model";
import {
  publishReusablePlacement,
  type ReusablePlacement,
} from "./material-reuse-model";

const students = [{ id: "student-1", name: "Ava" }];
const assessments = [{ id: "assignment-1", title: "Opening speech", maxScore: 10 }];

const submission = (
  overrides: Partial<GradebookSubmissionRow> = {},
): GradebookSubmissionRow => ({
  id: "submission-1",
  user_id: "student-1",
  assignment_id: "assignment-1",
  submission_state: "submitted",
  submitted_at: "2026-09-05T10:00:00.000Z",
  grade_status: "awaiting_review",
  score: null,
  score_max: 10,
  updated_at: "2026-09-05T10:01:00.000Z",
  ...overrides,
});

test("gradebook keeps missing evidence null and distinguishes zero, awaiting review, and unavailable", () => {
  const gradebook = buildClassGradebook(
    students,
    assessments,
    [
      submission({ id: "zero", grade_status: "graded", score: 0 }),
      submission({
        id: "awaiting",
        user_id: "student-2",
        grade_status: "awaiting_review",
        score: 0,
      }),
      submission({
        id: "invalid",
        user_id: "student-3",
        grade_status: "graded",
        score: 11,
      }),
    ],
  );

  const zero = gradebook.cells["student-1"]["assignment-1"];
  assert.equal(zero.status, "graded");
  assert.equal(zero.score, 0);

  const missing = buildClassGradebook(students, assessments, []).cells["student-1"]["assignment-1"];
  assert.equal(missing.status, "not_submitted");
  assert.equal(missing.score, null);
  assert.notEqual(missing.score, 0);

  const awaiting = buildClassGradebook(
    [{ id: "student-2", name: "Bo" }],
    assessments,
    [submission({ id: "awaiting", user_id: "student-2", score: 0 })],
  ).cells["student-2"]["assignment-1"];
  assert.equal(awaiting.status, "awaiting_review");
  assert.equal(awaiting.score, null);

  const unavailable = buildClassGradebook(
    [{ id: "student-3", name: "Chi" }],
    assessments,
    [submission({ id: "invalid", user_id: "student-3", grade_status: "graded", score: 11 })],
  ).cells["student-3"]["assignment-1"];
  assert.equal(unavailable.status, "unavailable");
  assert.equal(unavailable.score, null);
});

test("gradebook uses the newest submitted attempt and excludes pending drafts", () => {
  const gradebook = buildClassGradebook(students, assessments, [
    submission({
      id: "newest",
      grade_status: "graded",
      score: 8,
      submitted_at: "2026-09-05T12:00:00.000Z",
      updated_at: "2026-09-05T12:01:00.000Z",
    }),
    submission({
      id: "draft",
      submission_state: "draft",
      grade_status: "graded",
      score: 10,
      submitted_at: null,
    }),
    submission({
      id: "older",
      grade_status: "graded",
      score: 4,
      submitted_at: "2026-09-05T08:00:00.000Z",
    }),
  ]);

  assert.deepEqual(gradebook.cells["student-1"]["assignment-1"], {
    submissionId: "newest",
    status: "graded",
    score: 8,
    scoreMax: 10,
  });
});

const placement = (overrides: Partial<ReusablePlacement> = {}): ReusablePlacement => ({
  id: "placement-1",
  versionId: "version-1",
  status: "draft",
  audienceMode: "all",
  releaseAt: null,
  expiresAt: null,
  ruleCount: 0,
  ...overrides,
});

test("partial publish failure leaves a draft that a retry resumes with one insert", async () => {
  let stored: ReusablePlacement | null = null;
  let inserts = 0;
  let publishes = 0;
  let failPublish = true;
  const operations = {
    read: async () => stored,
    place: async () => {
      inserts += 1;
      stored = placement();
    },
    publish: async (placementId: string) => {
      assert.equal(placementId, "placement-1");
      publishes += 1;
      if (failPublish) {
        failPublish = false;
        throw new Error("temporary failure");
      }
      stored = placement({ status: "published" });
    },
  };

  await assert.rejects(publishReusablePlacement("version-1", operations), /temporary failure/);
  assert.deepEqual(stored, placement());
  await assert.doesNotReject(publishReusablePlacement("version-1", operations));
  assert.equal(inserts, 1);
  assert.equal(publishes, 2);
});

test("already published placement is a no-op", async () => {
  const calls = { place: 0, publish: 0 };
  const result = await publishReusablePlacement("version-1", {
    read: async () => placement({ status: "published" }),
    place: async () => { calls.place += 1; },
    publish: async () => { calls.publish += 1; },
  });

  assert.deepEqual(result, { placementId: "placement-1", status: "published", alreadyPublished: true });
  assert.deepEqual(calls, { place: 0, publish: 0 });
});

test("permission denied while placing never reports success", async () => {
  let reads = 0;
  let places = 0;
  await assert.rejects(
    publishReusablePlacement("version-1", {
      read: async () => { reads += 1; return null; },
      place: async () => { places += 1; throw new Error("FORBIDDEN"); },
      publish: async () => { throw new Error("must not publish"); },
    }),
    /FORBIDDEN/,
  );
  assert.equal(places, 1);
  assert.equal(reads, 2);
});

test("concurrent duplicate insert recovers the persisted draft", async () => {
  let reads = 0;
  let publishes = 0;
  let stored: ReusablePlacement | null = null;
  const result = await publishReusablePlacement("version-1", {
    read: async () => {
      reads += 1;
      if (reads === 1) return null;
      if (!stored) stored = placement();
      return stored;
    },
    place: async () => { throw new Error("duplicate key value violates unique constraint"); },
    publish: async (placementId: string) => {
      assert.equal(placementId, "placement-1");
      publishes += 1;
      stored = placement({ status: "published" });
    },
  });
  assert.equal(result.alreadyPublished, false);
  assert.equal(publishes, 1);
});

test("publish readback failure never reports success", async () => {
  let reads = 0;
  await assert.rejects(
    publishReusablePlacement("version-1", {
      read: async () => {
        reads += 1;
        return reads === 1 ? placement() : null;
      },
      place: async () => { throw new Error("must not place"); },
      publish: async () => {},
    }),
    /MATERIAL_READBACK_UNAVAILABLE/,
  );
});

test("restricted existing placements never publish", async () => {
  const cases: Array<[string, Partial<ReusablePlacement>]> = [
    ["audience", { audienceMode: "selected" }],
    ["release window", { releaseAt: "2026-09-06T09:00:00.000Z" }],
    ["expiry window", { expiresAt: "2026-09-07T09:00:00.000Z" }],
    ["rules", { ruleCount: 1 }],
    ["version", { versionId: "version-older" }],
  ];

  for (const [label, overrides] of cases) {
    let publishes = 0;
    await assert.rejects(
      publishReusablePlacement("version-1", {
        read: async () => placement(overrides),
        place: async () => { throw new Error(`must not place ${label}`); },
        publish: async () => { publishes += 1; },
      }),
      /MATERIAL_EXISTING_RESTRICTIONS/,
    );
    assert.equal(publishes, 0, `${label} placement was published`);
  }
});
