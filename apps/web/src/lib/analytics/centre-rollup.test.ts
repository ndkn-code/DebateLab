import assert from "node:assert/strict";
import test from "node:test";
import { buildCentreAnalytics, estimateMarkingWorkload } from "./centre-rollup";
import { centreFixture, uuid } from "./__fixtures__/analytics";
test("centre metrics deduplicate activity across classes and exclude inactive roster membership", () => {
  const input = centreFixture();
  input.classes = [
    ...input.classes,
    {
      ...input.classes[0],
      classId: uuid(10),
      activeLearnerIds: [...input.classes[0].activeLearnerIds, "no-activity"],
    },
  ];
  input.events = [
    ...input.events,
    input.events[0],
    { ...input.events[1], classId: uuid(10) },
  ];
  const report = buildCentreAnalytics(input);
  assert.equal(report.sessions, 1);
  assert.equal(report.activeLearners, 12);
  assert.equal(report.uniqueAiResponses, 12);
  assert.equal(report.markingWorkload.hours, 4);
});
test("AI revisions/stages/retries do not multiply responses, all skills counted but only Task2 estimated", () => {
  const input = centreFixture();
  const ai = input.events.find((event) => event.kind === "ai-grading")!;
  input.events = [
    ...input.events,
    { ...ai, id: "retry", revision: 8, occurredAt: "2026-09-03T00:00:00Z" },
    {
      ...ai,
      id: "speaking",
      responseId: "speaking",
      skill: "speaking",
      taskNumber: undefined,
    },
    { ...ai, id: "failed", responseId: "failed", status: "failed" },
  ];
  const report = buildCentreAnalytics(input);
  assert.equal(report.uniqueAiResponses, 13);
  assert.equal(report.markingWorkload.qualifyingResponses, 12);
});
test("feedback count includes unknown duration; pending is distinct; former teacher retains actual attribution", () => {
  const input = centreFixture();
  input.events = [
    ...input.events,
    {
      id: "unknown",
      kind: "feedback",
      status: "published",
      revision: 1,
      occurredAt: input.period.end,
      teacherId: "former",
      classId: input.classes[0].classId,
      turnedAroundHours: null,
    },
    {
      id: "pending",
      kind: "feedback",
      status: "pending",
      revision: 0,
      occurredAt: input.period.end,
    },
  ];
  const report = buildCentreAnalytics(input);
  assert.equal(report.turnedAroundRevisions.count, 13);
  assert.equal(report.turnedAroundRevisions.medianHours, 25);
  assert.equal(report.turnedAroundRevisions.pending, 1);
  assert.equal(
    report.teacherRows.find((row) => row.teacherId === "former")
      ?.publishedFeedback,
    1,
  );
  assert.deepEqual(
    report.teacherRows.find((row) => row.teacherId === "former")
      ?.currentClassIds,
    [],
  );
});
test("daily series includes zero days and uses centre date rather than UTC date", () => {
  const input = centreFixture();
  input.events = [
    {
      id: "near-midnight",
      kind: "session",
      status: "completed",
      occurredAt: "2026-09-02T20:00:00Z",
    },
  ];
  const report = buildCentreAnalytics(input);
  assert.equal(report.dailyTrend.length, 30);
  assert.equal(
    report.dailyTrend.find((row) => row.date === "2026-09-03")?.sessions,
    1,
  );
  assert.equal(
    report.dailyTrend.find((row) => row.date === "2026-09-02")?.sessions,
    0,
  );
});
test("required unavailable sources throw and estimates bound invalid values", () => {
  assert.throws(
    () =>
      buildCentreAnalytics({
        ...centreFixture(),
        sources: { operations: "unavailable" },
      }),
    /unavailable/,
  );
  assert.equal(estimateMarkingWorkload(12, 10).hours, 2);
  assert.equal(estimateMarkingWorkload(12, -10).hours, 0);
  assert.equal(estimateMarkingWorkload(Number.NaN).hours, 0);
});
