import type { Database } from "@/types/supabase";
import type {
  CentreEventFact,
  ReportingPeriod,
} from "@/lib/analytics/contracts";
import { localMidnight } from "./reporting-period";
type Row<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export interface CentreOperations {
  period: ReportingPeriod;
  occurrences: Pick<
    Row<"lms_lesson_occurrences">,
    "id" | "class_id" | "starts_at" | "status"
  >[];
  sessions: Pick<
    Row<"class_attendance_sessions">,
    "id" | "class_id" | "session_date" | "occurrence_id" | "taken_by"
  >[];
  attendance: Pick<
    Row<"class_attendance_records">,
    "id" | "session_id" | "user_id" | "status"
  >[];
  submissions: Pick<
    Row<"club_assignment_submissions">,
    | "id"
    | "class_id"
    | "user_id"
    | "assignment_id"
    | "revision_number"
    | "submission_state"
    | "grade_status"
    | "submitted_at"
  >[];
  gradeEvents: Pick<
    Row<"club_assignment_grade_events">,
    | "id"
    | "submission_id"
    | "revision_number"
    | "created_at"
    | "graded_by"
    | "grade_status"
  >[];
}
/** Recorded attendance means any attendance mark, including absence; it measures product use. */
export function normalizeCentreOperations({
  period,
  occurrences,
  sessions,
  attendance,
  submissions,
  gradeEvents,
}: CentreOperations): CentreEventFact[] {
  const events: CentreEventFact[] = [];
  const sessionMap = new Map(sessions.map((row) => [row.id, row]));
  const recordedSessions = new Set(attendance.map((row) => row.session_id));
  const attendanceByOccurrence = new Map(
    sessions
      .filter((row) => row.occurrence_id)
      .map((row) => [row.occurrence_id!, row]),
  );
  for (const occurrence of occurrences) {
    if (occurrence.status !== "completed") continue;
    const recorder = attendanceByOccurrence.get(occurrence.id)?.taken_by;
    events.push({
      id: occurrence.id,
      kind: "session",
      classId: occurrence.class_id,
      occurredAt: occurrence.starts_at,
      status: "completed",
      ...(recorder ? { teacherId: recorder } : {}),
    });
  }
  for (const session of sessions) {
    if (session.occurrence_id || !recordedSessions.has(session.id)) continue;
    events.push({
      id: `legacy:${session.id}`,
      kind: "session",
      classId: session.class_id,
      occurredAt: localMidnight(session.session_date, period.timezone),
      status: "completed",
      ...(session.taken_by ? { teacherId: session.taken_by } : {}),
    });
  }
  for (const row of attendance) {
    const session = sessionMap.get(row.session_id);
    if (!session) continue;
    events.push({
      id: row.id,
      kind: "activity",
      classId: session.class_id,
      learnerId: row.user_id,
      occurredAt: localMidnight(session.session_date, period.timezone),
    });
  }
  for (const submission of submissions) {
    // Draft/legacy rows without a submission timestamp are not submitted activity.
    if (!submission.class_id || !submission.submitted_at) continue;
    events.push({
      id: submission.id,
      kind: "activity",
      classId: submission.class_id,
      learnerId: submission.user_id,
      occurredAt: submission.submitted_at,
    });
    const firstFeedback = gradeEvents
      .filter(
        (row) =>
          row.submission_id === submission.id &&
          row.revision_number === submission.revision_number,
      )
      .sort(
        (a, b) =>
          a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
      )[0];
    events.push({
      id: `homework:${submission.id}:${submission.revision_number}`,
      kind: "feedback",
      classId: submission.class_id,
      learnerId: submission.user_id,
      assignmentId: submission.assignment_id,
      revision: submission.revision_number,
      occurredAt: firstFeedback?.created_at ?? period.end,
      status: firstFeedback ? "published" : "pending",
      ...(firstFeedback
        ? {
            teacherId: firstFeedback.graded_by,
            turnedAroundHours: Math.max(
              0,
              (Date.parse(firstFeedback.created_at) -
                Date.parse(submission.submitted_at)) /
                3_600_000,
            ),
          }
        : {}),
    });
  }
  return events;
}
