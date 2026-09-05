/**
 * Pure projection for the learner's assigned-work list.
 *
 * Delivery of homework used to depend entirely on a teacher linking an
 * assignment to a *published* lesson occurrence inside the requested week
 * (`lms_occurrence_assignments`, read at `student-weekly-repository.ts:132`).
 * Nothing in the application ever wrote that link, so assigned work reached the
 * learner only by direct URL. This model backs the occurrence-independent list
 * that closes the loop: every active assignment in a class the learner is an
 * active student of, whether or not it was ever scheduled.
 *
 * Kept free of `server-only` so it can be unit-tested directly.
 */

export type StudentAssignmentWorkState =
  | "not_started"
  | "in_progress"
  | "submitted"
  | "graded"
  | "returned"
  | "resubmit_requested";

export interface StudentAssignmentRow {
  id: string;
  club_id: string;
  class_id: string | null;
  title: string;
  assignment_type: string | null;
  due_at: string | null;
  required_attempts: number | null;
  status: string;
}

export interface StudentAssignmentSubmissionRow {
  assignment_id: string;
  submission_state: string | null;
  grade_status: string | null;
  score: number | null;
  score_max: number | null;
  feedback: string | null;
  graded_at: string | null;
  created_at: string;
}

export interface StudentAssignmentSummary {
  id: string;
  clubId: string;
  classId: string | null;
  classTitle: string;
  title: string;
  assignmentType: string;
  dueAt: string | null;
  requiredAttempts: number;
  attemptsUsed: number;
  state: StudentAssignmentWorkState;
  /** Needs the learner to act: never submitted, or the teacher asked for a revision. */
  outstanding: boolean;
  overdue: boolean;
  score: number | null;
  scoreMax: number | null;
  feedback: string | null;
  gradedAt: string | null;
  href: string;
}

/**
 * IELTS mocks are delivered by the mock player at `/ielts/assigned`; everything
 * else is homework and lands on the shared submit/grade workspace.
 */
export function assignmentHref(
  assignmentType: string,
  clubId: string,
  assignmentId: string,
): string {
  if (assignmentType === "ielts_mock") return "/ielts/assigned";
  return `/dashboard/clubs/${clubId}/assignments/${assignmentId}`;
}

function workState(
  submission: StudentAssignmentSubmissionRow | undefined,
): StudentAssignmentWorkState {
  if (!submission) return "not_started";
  if (submission.submission_state !== "submitted") {
    // draft / uploading / failed — the learner started but never landed it.
    return submission.submission_state === "failed" ? "not_started" : "in_progress";
  }
  if (submission.grade_status === "graded") return "graded";
  if (submission.grade_status === "returned") return "returned";
  if (submission.grade_status === "resubmit_requested") return "resubmit_requested";
  return "submitted";
}

function compareDueAt(left: string | null, right: string | null): number {
  if (left === right) return 0;
  if (!left) return 1;
  if (!right) return -1;
  return left.localeCompare(right);
}

export function buildStudentAssignmentSummaries(input: {
  assignments: StudentAssignmentRow[];
  classTitles: ReadonlyMap<string, string>;
  submissions: StudentAssignmentSubmissionRow[];
  now?: Date;
}): StudentAssignmentSummary[] {
  const now = (input.now ?? new Date()).getTime();

  const byAssignment = new Map<string, StudentAssignmentSubmissionRow[]>();
  for (const row of input.submissions) {
    const list = byAssignment.get(row.assignment_id) ?? [];
    list.push(row);
    byAssignment.set(row.assignment_id, list);
  }
  for (const list of byAssignment.values()) {
    list.sort((left, right) => right.created_at.localeCompare(left.created_at));
  }

  const summaries = input.assignments
    .filter((assignment) => assignment.status === "active")
    .map((assignment): StudentAssignmentSummary => {
      const attempts = byAssignment.get(assignment.id) ?? [];
      const latest = attempts[0];
      const state = workState(latest);
      const assignmentType = assignment.assignment_type ?? "case";
      const graded = state === "graded" || state === "returned";
      return {
        id: assignment.id,
        clubId: assignment.club_id,
        classId: assignment.class_id,
        classTitle: assignment.class_id
          ? (input.classTitles.get(assignment.class_id) ?? "")
          : "",
        title: assignment.title,
        assignmentType,
        dueAt: assignment.due_at,
        requiredAttempts: assignment.required_attempts ?? 1,
        attemptsUsed: attempts.filter(
          (row) => row.submission_state === "submitted",
        ).length,
        state,
        outstanding: state === "not_started" || state === "in_progress" || state === "resubmit_requested",
        overdue: Boolean(
          assignment.due_at && new Date(assignment.due_at).getTime() < now,
        ),
        score: graded && typeof latest?.score === "number" ? latest.score : null,
        scoreMax:
          graded && typeof latest?.score_max === "number" ? latest.score_max : null,
        feedback: graded ? (latest?.feedback ?? null) : null,
        gradedAt: graded ? (latest?.graded_at ?? null) : null,
        href: assignmentHref(assignmentType, assignment.club_id, assignment.id),
      };
    });

  return summaries.sort((left, right) => {
    if (left.outstanding !== right.outstanding) return left.outstanding ? -1 : 1;
    const byDue = compareDueAt(left.dueAt, right.dueAt);
    if (byDue !== 0) return byDue;
    return left.title.localeCompare(right.title);
  });
}

/**
 * The single piece of work the learner should open next, if any.
 *
 * Overdue work is deprioritised rather than hidden: `reserve_homework_submission`
 * refuses a late first attempt, so pointing the one dominant CTA at it sends the
 * learner into a dead end. It still surfaces in the list, with its own warning.
 */
export function selectNextStudentAssignment(
  summaries: readonly StudentAssignmentSummary[],
): StudentAssignmentSummary | null {
  const outstanding = summaries.filter((summary) => summary.outstanding);
  return (
    outstanding.find((summary) => !summary.overdue) ?? outstanding[0] ?? null
  );
}
