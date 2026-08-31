import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTeacherWorkspaceDemoManifest,
  parseTeacherWorkspaceDemoArgs,
  TEACHER_WORKSPACE_DEMO_TAG,
} from "./teacher-workspace-demo";

test("builds a deterministic tagged fixture covering the teacher workspace loop", () => {
  const input = {
    organizationId: "00000000-0000-4000-8000-000000000001",
    teacherId: "00000000-0000-4000-8000-000000000002",
    learnerIds: [
      "00000000-0000-4000-8000-000000000003",
      "00000000-0000-4000-8000-000000000004",
      "00000000-0000-4000-8000-000000000005",
    ],
    weekStart: "2026-08-31",
  };
  const first = buildTeacherWorkspaceDemoManifest(input);
  const second = buildTeacherWorkspaceDemoManifest(input);
  assert.deepEqual(first, second);
  const otherOrganization = buildTeacherWorkspaceDemoManifest({
    ...input,
    organizationId: "00000000-0000-4000-8000-000000000099",
  });
  assert.notEqual(
    first.tables.classes[0]?.id,
    otherOrganization.tables.classes[0]?.id,
  );
  assert.equal(first.tag, TEACHER_WORKSPACE_DEMO_TAG);
  assert.equal(first.tables.classes.length, 3);
  for (const table of [
    "courses",
    "course_modules",
    "lessons",
    "activities",
    "class_course_assignments",
    "class_schedules",
    "class_memberships",
    "lms_resources",
    "lms_resource_assignments",
    "lms_lesson_occurrences",
    "class_attendance_sessions",
    "class_attendance_records",
    "club_assignments",
    "club_assignment_submissions",
    "lms_announcements",
    "lms_notifications",
    "lms_outbox_events",
  ])
    assert.ok(first.tables[table].length > 0, `${table} is covered`);
  assert.deepEqual(
    first.tables.classes.map((row) => row.program_type),
    ["ielts", "debate", "public_speaking"],
  );
  assert.ok(
    first.tables.class_schedules.every(
      (row) =>
        (row.metadata as Record<string, unknown>).seed ===
        TEACHER_WORKSPACE_DEMO_TAG,
    ),
  );
  assert.ok(
    first.tables.club_assignments.every(
      (row) =>
        (row.metadata as Record<string, unknown>).seed ===
          TEACHER_WORKSPACE_DEMO_TAG &&
        (row.metadata as Record<string, unknown>).analytics_excluded === true,
    ),
  );
  assert.deepEqual(
    new Set(
      first.tables.club_assignments
        .filter(
          (row) =>
            (row.metadata as Record<string, unknown>).autoMarked === true,
        )
        .map((row) => (row.metadata as Record<string, unknown>).assignmentKey),
    ),
    new Set(["ielts-reading", "ielts-listening"]),
  );
  assert.ok(
    first.tables.club_assignment_submissions
      .filter(
        (row) => (row.metadata as Record<string, unknown>).autoMarked === true,
      )
      .every(
        (row) =>
          row.grade_status === "graded" &&
          row.score === 34 &&
          row.score_max === 40,
      ),
  );
  assert.ok(
    first.tables.club_assignment_submissions.every(
      (row) =>
        (row.metadata as Record<string, unknown>).seed ===
        TEACHER_WORKSPACE_DEMO_TAG,
    ),
  );
  assert.deepEqual(
    new Set(first.tables.lms_lesson_occurrences.map((row) => row.status)),
    new Set(["scheduled", "completed", "cancelled"]),
  );
  assert.deepEqual(
    new Set(
      first.tables.club_assignment_submissions.map((row) => row.grade_status),
    ),
    new Set(["submitted", "returned", "graded"]),
  );
  assert.ok(
    first.tables.lms_resources.every(
      (row) =>
        row.status === "published" &&
        row.license_status === "approved" &&
        row.provenance,
    ),
  );
  assert.ok(
    first.tables.lms_outbox_events.every(
      (row) =>
        row.status === "cancelled" &&
        (row.recipient_ids as unknown[]).length === 0 &&
        (row.email_recipient_ids as unknown[]).length === 0,
    ),
  );
  assert.deepEqual(
    first.tables.lms_pilot_flags.map((row) => row.feature_key),
    ["teacher_workspace_v2", "teacher_workspace_v2", "teacher_workspace_v2"],
  );
  assert.deepEqual(
    first.tables.teacher_workspace_class_preferences.map(
      (row) => row.color_token,
    ),
    ["teal", "amber", "violet"],
  );
  assert.ok(
    first.tables.teacher_workspace_class_preferences.every(
      (row) =>
        Object.keys(row).sort().join(",") === "class_id,color_token,user_id",
    ),
  );
  assert.ok(
    first.tables.lms_occurrence_assignments.every(
      (row) =>
        Object.keys(row).sort().join(",") ===
        "added_by,assignment_id,occurrence_id,relation_type",
    ),
  );
  assert.ok(
    first.tables.lms_occurrence_roster_snapshots.every(
      (row) =>
        Object.keys(row).sort().join(",") ===
        "class_membership_id,enrollment_status,occurrence_id,user_id",
    ),
  );
});

test("CLI defaults to dry run and requires explicit project ref before apply", () => {
  assert.deepEqual(parseTeacherWorkspaceDemoArgs([]), {
    apply: false,
    cleanup: false,
    organizationId: null,
    projectRef: null,
    email: "nguyennguyen.dymun@gmail.com",
    weekStart: "2026-08-31",
  });
  assert.equal(
    parseTeacherWorkspaceDemoArgs([
      "--apply",
      "--project-ref",
      "project",
      "--organization-id",
      "org",
    ]).apply,
    true,
  );
  assert.throws(
    () =>
      parseTeacherWorkspaceDemoArgs(["--apply", "--project-ref", "project"]),
    /organization-id/,
  );
  assert.throws(
    () =>
      parseTeacherWorkspaceDemoArgs(["--cleanup", "--organization-id", "org"]),
    /project-ref/,
  );
  assert.throws(
    () => parseTeacherWorkspaceDemoArgs(["--email", "someone@example.com"]),
    /fixed/,
  );
  assert.throws(
    () => parseTeacherWorkspaceDemoArgs(["--apply", "--cleanup"]),
    /not both/,
  );
});
