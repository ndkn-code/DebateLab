import assert from "node:assert/strict";
import test from "node:test";
import { buildClassAnalytics, buildPostMockReport } from "./class-rollup";
import { buildPostMockExport } from "./exports";
import { classFixture, uuid } from "./__fixtures__/analytics";
import { sheetsToCsv } from "@/lib/export/csv";

test("150 learners and 1200 evidence rows retain all coverage, provenance and partial skills", () => {
  const input = classFixture();
  assert.equal(input.criterionEvidence.length, 1200);
  const report = buildClassAnalytics(input);
  assert.equal(report.coverage.learnerCount, 150);
  assert.equal(report.criterionSummaries.length, 8);
  assert.equal(report.criterionSummaries[0].learnerCount, 150);
  assert.equal(
    report.skillSummaries.find((row) => row.skill === "speaking")?.learnerCount,
    120,
  );
  assert.equal(report.assessments[0].provisionalLearners, 150);
  assert.ok(report.criterionSummaries[0].provenance.teacherConfirmed > 0);
  assert.ok(report.criterionSummaries[0].provenance.aiAdjudicated > 0);
  assert.ok(
    report.criterionSummaries[0].label.vi !==
      report.criterionSummaries[0].criterion,
  );
  assert.equal("overall" in report, false);
});
test("current teacher criteria override newer stale and provisional AI evidence", () => {
  const input = classFixture(1);
  const target = input.rows[0].assignments[0].reviewTargets[0];
  input.criterionEvidence = [
    ...input.criterionEvidence,
    {
      ...input.criterionEvidence[0],
      revision: 8,
      band: 1,
      createdAt: "2026-09-03T00:00:00Z",
    },
  ];
  const report = buildClassAnalytics(input);
  const criterion = report.criterionSummaries.find(
    (row) => row.task === "task1" && row.criterion === target.criteria[0].key,
  )!;
  assert.equal(criterion.meanBand, 5.5);
  assert.equal(criterion.provenance.teacherConfirmed, 1);
});
test("equal learner weighting averages within learner before class, separately per task", () => {
  const input = classFixture(2);
  const original = input.rows[0].assignments[0];
  original.reviewTargets.forEach((target) =>
    target.criteria.forEach((criterion) => {
      criterion.teacherBand = null;
      criterion.reviewStatus = "none";
    }),
  );
  const repeated = structuredClone(original);
  repeated.assignmentId = uuid(9);
  repeated.submittedAt = "2026-09-03T00:00:00Z";
  repeated.reviewTargets.forEach((target) => {
    target.responseId += "-second";
    target.assignmentId = repeated.assignmentId;
    target.criteria.forEach((criterion) => {
      criterion.aiBand = 9;
      criterion.teacherBand = null;
      criterion.reviewStatus = "none";
    });
  });
  input.rows[0].assignments.push(repeated);
  const report = buildClassAnalytics(input);
  assert.equal(
    report.criterionSummaries.find(
      (row) => row.task === "task1" && row.criterion === "taskAchievement",
    )?.meanBand,
    6,
  ); // ((5+9)/2 + 5)/2
});
test("overdue excludes submitted/draft assignments, reason tiers dominate absence counts", () => {
  const input = classFixture(3);
  input.rows[0].assignments[0].submittedAt = null;
  input.rows[1].assignments[0].submittedAt = null;
  input.rows[1].assignments[0].status = "draft";
  input.attendance = [
    { learnerId: input.rows[2].userId, present: 0, late: 0, absent: 100 },
  ];
  const report = buildClassAnalytics(input);
  assert.equal(report.attention[0].learnerId, input.rows[0].userId);
  assert.ok(
    !report.attention.some((row) => row.learnerId === input.rows[1].userId),
  );
  assert.ok(
    !report.attention
      .find((row) => row.learnerId === input.rows[2].userId)
      ?.reasons.some((reason) => reason.code === "overdue_assignment"),
  );
});
test("groups split five into three and two, retain singleton and missing evidence", () => {
  const input = classFixture(7);
  input.rows.forEach((row, index) => {
    row.assignments[0].score.writing = index < 5 ? 5 : index === 5 ? 7 : null;
  });
  const report = buildClassAnalytics(input);
  assert.deepEqual(
    report.groups
      .filter((row) => row.skill === "writing")
      .map((row) => row.learners.length),
    [3, 2, 1],
  );
  assert.equal(report.groupsMissingEvidence.writing.length, 1);
  assert.deepEqual(
    buildClassAnalytics({ ...input, rows: [...input.rows].reverse() }).groups,
    report.groups,
  );
});
test("out-of-period, no-data and removed learners do not become current low scores", () => {
  const input = classFixture(3);
  input.rows[0].assignments[0].submittedAt = "2025-01-01T00:00:00Z";
  input.rows[1].historical = true;
  input.rows[1].membershipStatus = "removed";
  input.rows[2].assignments = [];
  const report = buildClassAnalytics(input);
  assert.equal(report.coverage.totalLearners, 2);
  assert.equal(report.skillSummaries[0].meanBand, null);
  assert.equal(report.criterionSummaries.length, 0);
  assert.equal(report.insufficientEvidence.length, 2);
});
test("parent projection and both formats contain no learner identifiers or cross-assessment advice", () => {
  const input = classFixture(3);
  input.weakSubskills = [
    {
      learnerId: input.rows[0].userId,
      skill: "writing",
      subskill: "private-topic",
      label: { en: "Private learner topic", vi: "Chủ đề cá nhân" },
      severity: 1,
      source: "learner-wide",
      evidenceCount: 3,
      confidence: 1,
      lastEvidenceAt: "2026-09-03T00:00:00Z",
    },
  ];
  const report = buildClassAnalytics(input);
  const post = buildPostMockReport(report, uuid(3))!;
  assert.ok(post);
  assert.equal(post.provisionalCount, 3);
  assert.ok(!JSON.stringify(post).includes("private-topic"));
  for (const locale of ["en", "vi"] as const)
    for (const format of ["xlsx", "csv"] as const) {
      const exported = buildPostMockExport(post, locale, format);
      const bytes = new TextDecoder().decode(exported.bytes);
      for (const learner of input.rows) {
        assert.ok(!bytes.includes(learner.userId));
        assert.ok(!bytes.includes(learner.email));
        assert.ok(!bytes.includes(learner.displayName));
      }
      if (format === "csv") {
        assert.ok(bytes.includes(post.classTitle));
        assert.ok(bytes.includes(post.methodology[locale]));
        assert.ok(bytes.includes(post.period.timezone));
      }
      assert.ok(exported.bytes.length > 300);
    }
  assert.equal(buildPostMockReport(report, "other-class-assessment"), null);
  assert.equal(typeof sheetsToCsv, "function");
});
