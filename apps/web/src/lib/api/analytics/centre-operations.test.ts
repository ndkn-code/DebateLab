import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeCentreOperations,
  type CentreOperations,
} from "./centre-operations";
import { centreFixture } from "@/lib/analytics/__fixtures__/analytics";
import { buildCentreAnalytics } from "@/lib/analytics/centre-rollup";
test("linked attendance does not duplicate lessons, legacy recorded sessions qualify, and revisions stay distinct", () => {
  const input = centreFixture();
  const classId = input.classes[0].classId;
  const operations: CentreOperations = {
    period: input.period,
    occurrences: [
      {
        id: "lesson",
        class_id: classId,
        starts_at: "2026-09-02T01:00:00Z",
        status: "completed",
      },
      {
        id: "cancelled",
        class_id: classId,
        starts_at: "2026-09-02T01:00:00Z",
        status: "cancelled",
      },
    ],
    sessions: [
      {
        id: "linked",
        class_id: classId,
        occurrence_id: "lesson",
        session_date: "2026-09-02",
        taken_by: "actor",
      },
      {
        id: "legacy",
        class_id: classId,
        occurrence_id: null,
        session_date: "2026-09-02",
        taken_by: "actor",
      },
      {
        id: "unrecorded",
        class_id: classId,
        occurrence_id: null,
        session_date: "2026-09-02",
        taken_by: "actor",
      },
    ],
    attendance: [
      {
        id: "mark1",
        session_id: "linked",
        user_id: "learner",
        status: "present",
      },
      {
        id: "mark2",
        session_id: "legacy",
        user_id: "learner",
        status: "absent",
      },
      {
        id: "mark3",
        session_id: "legacy",
        user_id: "absent-learner",
        status: "absent",
      },
    ],
    submissions: [0, 1].map((revision) => ({
      id: `submission${revision}`,
      class_id: classId,
      user_id: "learner",
      assignment_id: "work",
      revision_number: revision,
      submission_state: "submitted",
      grade_status: "graded",
      submitted_at: "2026-09-01T01:00:00Z",
    })),
    gradeEvents: [0, 1].flatMap((revision) =>
      [0, 1].map((retry) => ({
        id: `grade${revision}:${retry}`,
        submission_id: `submission${revision}`,
        revision_number: revision,
        created_at: `2026-09-0${retry + 2}T01:00:00Z`,
        graded_by: "actor",
        grade_status: "graded",
      })),
    ),
  };
  const events = normalizeCentreOperations(operations);
  const report = buildCentreAnalytics({ ...input, events });
  assert.equal(report.sessions, 2);
  assert.equal(report.activeLearners, 2);
  assert.equal(report.turnedAroundRevisions.count, 2);
  assert.equal(report.turnedAroundRevisions.medianHours, 24);
  assert.equal(
    report.teacherRows.find((row) => row.teacherId === "actor")?.sessions,
    2,
  );
  assert.equal(
    report.teacherRows.find((row) => row.teacherId === "actor")
      ?.publishedFeedback,
    2,
  );
});

test("unsubmitted drafts do not invent learner activity", () => {
  const { period } = centreFixture();
  const events = normalizeCentreOperations({
    period, occurrences: [],
    sessions: [{ id: "legacy", class_id: "class", occurrence_id: null, session_date: "2026-09-02", taken_by: "actor" }],
    attendance: [{ id: "mark", session_id: "legacy", user_id: "learner", status: "present" }],
    submissions: [{ id: "draft", class_id: "class", user_id: "learner", assignment_id: "work", revision_number: 1, submission_state: "draft", grade_status: "ungraded", submitted_at: null }],
    gradeEvents: [],
  });
  assert.equal(events.filter((event) => event.kind === "session").length, 1);
  assert.equal(events.filter((event) => event.kind === "feedback").length, 0);
});
