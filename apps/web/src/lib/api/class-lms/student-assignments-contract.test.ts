import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  assignmentHref,
  buildStudentAssignmentSummaries,
  selectNextStudentAssignment,
  type StudentAssignmentRow,
  type StudentAssignmentSubmissionRow,
} from "./student-assignments-model";

// ---------------------------------------------------------------------------
// Pure projection
// ---------------------------------------------------------------------------

const classTitles = new Map([["class-1", "IELTS Evening"]]);

function assignment(
  overrides: Partial<StudentAssignmentRow> & { id: string },
): StudentAssignmentRow {
  return {
    club_id: "club-1",
    class_id: "class-1",
    title: overrides.id,
    assignment_type: "case",
    due_at: null,
    required_attempts: 1,
    status: "active",
    ...overrides,
  };
}

function submission(
  overrides: Partial<StudentAssignmentSubmissionRow> & { assignment_id: string },
): StudentAssignmentSubmissionRow {
  return {
    submission_state: "submitted",
    grade_status: "submitted",
    score: null,
    score_max: null,
    feedback: null,
    graded_at: null,
    created_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

// Delivery no longer depends on a lesson occurrence: an assignment that was
// never scheduled must still reach the learner.
{
  const summaries = buildStudentAssignmentSummaries({
    assignments: [assignment({ id: "a1", title: "Week 1", due_at: "2026-09-10T00:00:00.000Z" })],
    classTitles,
    submissions: [],
  });
  assert.equal(summaries.length, 1);
  assert.equal(summaries[0].state, "not_started");
  assert.equal(summaries[0].outstanding, true);
  assert.equal(summaries[0].classTitle, "IELTS Evening");
  assert.equal(
    summaries[0].href,
    "/dashboard/clubs/club-1/assignments/a1",
  );
}

// Only active assignments are delivered.
{
  const summaries = buildStudentAssignmentSummaries({
    assignments: [
      assignment({ id: "a1" }),
      assignment({ id: "a2", status: "archived" }),
    ],
    classTitles,
    submissions: [],
  });
  assert.deepEqual(
    summaries.map((item) => item.id),
    ["a1"],
  );
}

// A resubmit request is outstanding again; a graded submission is not.
{
  const summaries = buildStudentAssignmentSummaries({
    assignments: [assignment({ id: "a1" }), assignment({ id: "a2" })],
    classTitles,
    submissions: [
      submission({
        assignment_id: "a1",
        grade_status: "resubmit_requested",
        created_at: "2026-09-02T00:00:00.000Z",
      }),
      submission({
        assignment_id: "a2",
        grade_status: "graded",
        score: 8,
        score_max: 10,
        feedback: "Good.",
        graded_at: "2026-09-03T00:00:00.000Z",
      }),
    ],
  });
  const byId = new Map(summaries.map((item) => [item.id, item]));
  assert.equal(byId.get("a1")?.state, "resubmit_requested");
  assert.equal(byId.get("a1")?.outstanding, true);
  assert.equal(byId.get("a2")?.state, "graded");
  assert.equal(byId.get("a2")?.outstanding, false);
  assert.equal(byId.get("a2")?.score, 8);
  assert.equal(byId.get("a2")?.feedback, "Good.");
  // An ungraded submission must not leak a stale score/feedback.
  assert.equal(byId.get("a1")?.score, null);
  assert.equal(byId.get("a1")?.feedback, null);
}

// The newest attempt decides the state, and only finalized attempts count.
{
  const summaries = buildStudentAssignmentSummaries({
    assignments: [assignment({ id: "a1" })],
    classTitles,
    submissions: [
      submission({
        assignment_id: "a1",
        created_at: "2026-09-01T00:00:00.000Z",
      }),
      submission({
        assignment_id: "a1",
        submission_state: "draft",
        created_at: "2026-09-05T00:00:00.000Z",
      }),
    ],
  });
  assert.equal(summaries[0].state, "in_progress");
  assert.equal(summaries[0].outstanding, true);
  assert.equal(summaries[0].attemptsUsed, 1);
}

// Outstanding work sorts first, then by due date with undated work last.
{
  const summaries = buildStudentAssignmentSummaries({
    assignments: [
      assignment({ id: "later", due_at: "2026-09-20T00:00:00.000Z" }),
      assignment({ id: "undated" }),
      assignment({ id: "sooner", due_at: "2026-09-10T00:00:00.000Z" }),
      assignment({ id: "done", due_at: "2026-09-01T00:00:00.000Z" }),
    ],
    classTitles,
    submissions: [
      submission({ assignment_id: "done", grade_status: "graded" }),
    ],
  });
  assert.deepEqual(
    summaries.map((item) => item.id),
    ["sooner", "later", "undated", "done"],
  );
  assert.equal(selectNextStudentAssignment(summaries)?.id, "sooner");
}

// Overdue is reported, not hidden — the RPC refuses a late submission and the
// learner needs to know why the button will not work.
{
  const summaries = buildStudentAssignmentSummaries({
    assignments: [assignment({ id: "a1", due_at: "2026-08-01T00:00:00.000Z" })],
    classTitles,
    submissions: [],
    now: new Date("2026-09-04T00:00:00.000Z"),
  });
  assert.equal(summaries[0].overdue, true);
  assert.equal(summaries[0].outstanding, true);
}

// IELTS mocks route to the mock player, homework to the submit workspace.
assert.equal(assignmentHref("ielts_mock", "club-1", "a1"), "/ielts/assigned");
assert.equal(
  assignmentHref("case", "club-1", "a1"),
  "/dashboard/clubs/club-1/assignments/a1",
);

// ---------------------------------------------------------------------------
// Wiring + migration contract
// ---------------------------------------------------------------------------

const repository = readFileSync(
  resolve(process.cwd(), "src/lib/api/class-lms/student-assignments-repository.ts"),
  "utf8",
);
const classesPage = readFileSync(
  resolve(process.cwd(), "src/app/[locale]/(protected)/ielts/classes/page.tsx"),
  "utf8",
);
const assignedPage = readFileSync(
  resolve(process.cwd(), "src/app/[locale]/(protected)/ielts/assigned/page.tsx"),
  "utf8",
);
const weekView = readFileSync(
  resolve(process.cwd(), "src/components/lms/StudentLmsWeek.tsx"),
  "utf8",
);
const migration = readFileSync(
  resolve(
    process.cwd(),
    "../../supabase/migrations/20260904120000_homework_delivery_and_grade_notifications.sql",
  ),
  "utf8",
);

// The delivery read must be scoped by active student membership and must never
// depend on lesson occurrences.
assert.match(repository, /member_role", "student"/);
assert.match(repository, /\.eq\("status", "active"\)/);
assert.match(repository, /\.eq\("status", "active"\)[\s\S]*from\("club_assignment/);
assert.doesNotMatch(repository, /lms_occurrence_assignments/);
assert.doesNotMatch(repository, /lms_lesson_occurrences/);
// User-scoped client only: no service-role escape hatch on a learner read.
assert.doesNotMatch(repository, /service_role|SERVICE_ROLE|createServiceClient/);
assert.match(repository, /\.eq\("user_id", userId\)/);

// Both learner surfaces consume it.
assert.match(classesPage, /loadMyAssignedWork/);
assert.match(classesPage, /assignedWork=\{assignedWork\}/);
assert.match(assignedPage, /loadMyAssignedWork/);
assert.match(assignedPage, /STUDENT_LMS_WORKSPACE_V1/);
assert.match(weekView, /AssignedWorkList/);
assert.match(weekView, /scheduledAssignmentIds/);

// Migration: the not-null defect that blocked every file submission.
assert.match(
  migration,
  /alter table public\.club_assignment_submissions\s*\n\s*alter column submitted_at drop not null;/,
);
// Migration: a teacher-requested revision survives the due date, a first
// attempt does not. The reordering is the whole point, so assert the order.
assert.match(
  migration,
  /create or replace function public\.reserve_homework_submission/,
);
assert.match(
  migration,
  /if previous_id is null\s*\n\s*and assignment_row\.due_at is not null\s*\n\s*and assignment_row\.due_at < now\(\) then\s*\n\s*raise exception 'ASSIGNMENT_PAST_DUE';/,
);
{
  const reserveBody = migration.slice(
    migration.indexOf("create or replace function public.reserve_homework_submission"),
  );
  const previousIdAt = reserveBody.indexOf("select s.id into previous_id");
  const pastDueAt = reserveBody.indexOf("raise exception 'ASSIGNMENT_PAST_DUE'");
  assert.ok(previousIdAt > 0 && pastDueAt > 0);
  assert.ok(
    previousIdAt < pastDueAt,
    "ASSIGNMENT_PAST_DUE must be raised after the resubmit predecessor is resolved",
  );
  // The attempt cap must stay.
  assert.ok(reserveBody.includes("raise exception 'ATTEMPTS_EXHAUSTED'"));
}

// Migration: assignment-published no longer requires an IELTS mock.
assert.match(
  migration,
  /create or replace function private\.enqueue_lms_assignment_published/,
);
assert.match(
  migration,
  /if new\.assignment_type = 'ielts_mock' and new\.ielts_test_id is null then/,
);
// Migration: grading notifies the learner who owns the submission.
assert.match(
  migration,
  /create or replace function private\.enqueue_lms_homework_graded/,
);
assert.match(
  migration,
  /after update of grade_status on public\.club_assignment_submissions/,
);
assert.match(migration, /new\.user_id\s*\n\s*\);/);
assert.match(migration, /if new\.submission_state <> 'submitted' then return new; end if;/);
// Migration: due-soon reminders cover homework, not only mocks.
assert.match(
  migration,
  /\(a\.assignment_type <> 'ielts_mock' or a\.ielts_test_id is not null\)/,
);
// The trigger helper stays private.
assert.match(
  migration,
  /revoke all on function private\.enqueue_lms_homework_graded\(\) from public, anon, authenticated;/,
);

// Migration: the notification payload reaches the learner surface so the copy
// can be rendered bilingually instead of shipping the trigger's English.
assert.match(
  migration,
  /alter table public\.lms_notifications\s*\n\s*add column if not exists payload jsonb not null default '\{\}'::jsonb;/,
);
assert.match(
  migration,
  /create or replace function private\.materialize_lms_notification/,
);
assert.match(migration, /coalesce\(new\.payload, '\{\}'::jsonb\) - 'notification'/);
assert.match(migration, /'assignmentTitle', new\.title/);
assert.match(migration, /'assignmentTitle', v_assignment_title/);

const weeklyRepository = readFileSync(
  resolve(process.cwd(), "src/lib/api/class-lms/student-weekly-repository.ts"),
  "utf8",
);
assert.match(weeklyRepository, /event_type, title, body, payload, read_at, created_at/);
assert.match(weekView, /function notificationCopy\(/);
assert.match(weekView, /notificationCopy\(notification, vi\)\.title/);

// The deadline relaxation has to hold on every layer or the learner is still
// locked out: the action must not re-check it, and the client must not disable
// the button when the teacher asked for a revision.
const submitAction = readFileSync(
  resolve(process.cwd(), "src/app/actions/club-homework.ts"),
  "utf8",
);
{
  const submitFn = submitAction.slice(
    submitAction.indexOf("export async function submitClubAssignment"),
    submitAction.indexOf("export async function recordAssignmentSubmissionFiles"),
  );
  assert.ok(submitFn.length > 0);
  assert.doesNotMatch(
    submitFn,
    /throw new Error\("ASSIGNMENT_PAST_DUE"\)/,
    "submitClubAssignment must leave the deadline to reserve_homework_submission, which allows a requested revision",
  );
}
const workspace = readFileSync(
  resolve(process.cwd(), "src/components/admin/clubs/ClubHomeworkWorkspace.tsx"),
  "utf8",
);
assert.match(workspace, /const revisionRequested =/);
assert.match(workspace, /revisionRequested \|\| !pastDue/);
// The upload must use the MIME the server recorded, never the browser's guess.
assert.match(workspace, /contentType: target\.mimeType \?\? undefined/);
assert.doesNotMatch(workspace, /contentType: file\.type/);

console.log("Student assignment delivery contract tests passed");
