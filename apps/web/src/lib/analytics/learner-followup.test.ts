import assert from "node:assert/strict";
import test from "node:test";
import { buildClassAnalytics } from "./class-rollup";
import { classFixture } from "./__fixtures__/analytics";
import {
  projectLearnerFollowup,
} from "./learner-followup";
import type { ClassAnalyticsData } from "@/lib/api/analytics/class-repository";

function data(): ClassAnalyticsData {
  const input = classFixture(2);
  const report = buildClassAnalytics(input);
  return {
    report,
    snapshot: {
      gradebook: {
        classId: input.classId,
        clubId: input.clubId,
        classTitle: input.classTitle,
        rubric: [] as never,
        rows: [...input.rows],
        nextCursor: null,
        summary: {
          totalStudents: 2,
          started: 2,
          submitted: 2,
          completed: 0,
          needsReview: 2,
          averageOverallBand: null,
          skillAverages: {
            listening: null,
            reading: null,
            writing: null,
            speaking: null,
          },
        },
      },
      speakingRows: [],
    },
    weakSubskills: [],
    attendance: [
      { userId: input.rows[0].userId, date: "2026-09-02", status: "present" },
      { userId: input.rows[1].userId, date: "2026-09-02", status: "absent" },
    ],
    sourceErrors: {},
  };
}

test("projection isolates the selected learner and preserves assignment evidence", () => {
  const source = data();
  const selected = source.snapshot.gradebook.rows[0];
  const result = projectLearnerFollowup(source, source.report.classId, selected.userId)!;
  assert.equal(result.studentId, selected.userId);
  assert.equal(result.clubId, source.snapshot.gradebook.clubId);
  assert.equal(result.displayName, selected.displayName);
  assert.deepEqual(result.attendance, [
    { date: "2026-09-02", status: "present" },
  ]);
  assert.equal(result.assignments[0].status, selected.assignments[0].status);
  assert.equal(result.assignments[0].reviewTargets[0].scoringStatus, "scored");
  assert.equal(result.assignments[0].reviewTargets[0].media, null);
  assert.ok(!JSON.stringify(result).includes(source.snapshot.gradebook.rows[1].displayName));
});

test("projection reports unavailable subskills without fabricating weaknesses or reasons", () => {
  const source = data();
  source.report.sources.subskills = "unavailable";
  source.report.attention = [];
  const result = projectLearnerFollowup(
    source,
    source.report.classId,
    source.snapshot.gradebook.rows[0].userId,
  )!;
  assert.equal(result.sources.subskills, "unavailable");
  assert.deepEqual(result.weaknesses, []);
  assert.deepEqual(result.reasons, []);
});

test("projection refuses historical or inactive learners", () => {
  const source = data();
  source.snapshot.gradebook.rows[1].membershipStatus = "removed";
  assert.equal(
    projectLearnerFollowup(
      source,
      source.report.classId,
      source.snapshot.gradebook.rows[1].userId,
    ),
    null,
  );
});
