import assert from "node:assert/strict";
import {
  defaultReportMonth,
  reportMonthOptions,
  reportPeriod,
} from "./request";
import { normalizeParentBandReport } from "./model";

const now = new Date("2026-08-31T17:00:00.000Z");
const context = {
  classId: "c",
  clubId: "b",
  studentId: "s",
  studentName: "A",
  className: "C",
  centreName: "X",
};
const assessment = (id: string, date: string, score: number | null = 6) => ({
  attemptId: id,
  assignmentId: `a-${id}`,
  title: id,
  submittedAt: date,
  skills: { listening: score, reading: score, writing: score, speaking: score },
  overall: score,
  source: "ai" as const,
});

assert.equal(defaultReportMonth(now), "2026-08");
assert.equal(
  defaultReportMonth(new Date("2026-08-31T16:59:59.000Z")),
  "2026-07",
);
assert.equal(reportMonthOptions(now)[0], "2026-09");
assert.equal(reportMonthOptions(now).length, 24);
const period = reportPeriod("2026-08", now);
assert.equal(period.startDate, "2026-08-01");
assert.equal(period.endDate, "2026-09-01");
assert.equal(period.isCurrentMonth, false);
assert.throws(() => reportPeriod("2026-10", now));
assert.equal(
  reportPeriod("2024-02", new Date("2024-02-15T00:00:00Z")).endDate,
  "2024-03-01",
);

const report = normalizeParentBandReport({
  context,
  period: { month: "2026-08" },
  assessments: [
    assessment("new", "2026-08-20T00:00:00Z"),
    assessment("old", "2026-08-10T00:00:00Z"),
    assessment("mar", "2026-03-10T00:00:00Z"),
    assessment("apr", "2026-04-10T00:00:00Z"),
    assessment("may", "2026-05-10T00:00:00Z"),
    assessment("jun", "2026-06-10T00:00:00Z"),
    assessment("jul", "2026-07-10T00:00:00Z"),
  ],
  criteria: [],
});
assert.equal(report.headlineAssessment?.attemptId, "new");
assert.equal(report.trajectory.length, 7);
assert.equal(report.trajectory[0]?.attemptId, "mar");

const partial = normalizeParentBandReport({
  context,
  period: { month: "2026-08" },
  assessments: [
    {
      ...assessment("partial", "2026-08-20T00:00:00Z"),
      skills: { listening: 6, reading: null, writing: null, speaking: null },
      overall: 9,
      overallState: "complete",
    },
  ],
});
assert.equal(partial.headlineAssessment?.overall, null);
assert.deepEqual(partial.availability.missingSkills, [
  "reading",
  "writing",
  "speaking",
]);
assert.equal(partial.availability.pendingCount, 1);

console.log("parent report model tests passed");

const dst = reportPeriod("2026-03", now, "America/New_York");
assert.equal(dst.start, "2026-03-01T05:00:00.000Z");
assert.equal(dst.end, "2026-04-01T04:00:00.000Z");
const ny = normalizeParentBandReport(
  {
    context,
    period: { month: "2026-08", timeZone: "America/New_York" },
    assessments: [
      assessment("before", "2026-08-01T03:59:59Z"),
      assessment("after", "2026-08-01T04:00:00Z"),
    ],
  },
  now,
);
assert.equal(ny.availability.assessedCount, 1);
assert.equal(ny.headlineAssessment?.attemptId, "after");
assert.equal(ny.skills[0].source, "objective");
