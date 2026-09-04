import "server-only";
import {
  allRows,
  text,
  type Db,
  type Row,
  type ParentReportScope,
} from "./parent-report-query";
import { reportPeriod } from "@/lib/ielts/parent-report/request";
import type { ParentBandReport } from "@/lib/ielts/parent-report/contract";
function calendarDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

/** Roster snapshots outrank today's membership when reporting a historical session. */
export function selectParentAttendanceSessions(input: {
  sessions: Row[];
  records: Row[];
  occurrences: Row[];
  snapshots: Row[];
  membership: Row;
  studentId: string;
  timeZone: string;
  now: Date;
}): ParentBandReport["attendance"]["sessions"] {
  const records = new Map(
    input.records.map((row) => [text(row.session_id), text(row.status)]),
  );
  const occurrences = new Map(
    input.occurrences.map((row) => [text(row.id), row]),
  );
  const snapshots = new Map(
    input.snapshots
      .filter((row) => row.user_id === input.studentId)
      .map((row) => [text(row.occurrence_id), row]),
  );
  const today = calendarDate(input.now.toISOString(), input.timeZone);
  const joined = text(input.membership.joined_at);
  const removed = text(input.membership.removed_at);
  return input.sessions
    .filter((session) => {
      const day = text(session.session_date);
      if (day > today) return false;
      const occurrenceId = text(session.occurrence_id);
      if (occurrenceId) {
        const occurrence = occurrences.get(occurrenceId);
        if (
          !occurrence ||
          occurrence.status === "cancelled" ||
          occurrence.occurrence_date !== day ||
          new Date(text(occurrence.starts_at)) > input.now
        )
          return false;
        const snapshot = snapshots.get(occurrenceId);
        if (snapshot)
          return ["enrolled", "removed_after_occurrence"].includes(
            text(snapshot.enrollment_status),
          );
      }
      // Explicit attendance is historical evidence even after a later re-enrolment.
      if (records.has(text(session.id))) return true;
      return (
        (!joined || day >= calendarDate(joined, input.timeZone)) &&
        (!removed || day <= calendarDate(removed, input.timeZone))
      );
    })
    .map((row): ParentBandReport["attendance"]["sessions"][number] => {
      const status = records.get(text(row.id));
      return {
        sessionId: text(row.id),
        date: text(row.session_date),
        title: text(row.title),
        status:
          status === "present" || status === "late" || status === "absent"
            ? status
            : "unmarked",
      };
    })
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || a.sessionId.localeCompare(b.sessionId),
    );
}

export async function attendanceForStudent(
  trusted: Db,
  context: ParentReportScope,
  studentId: string,
  membership: Row,
  month: string,
  now: Date,
) {
  const period = reportPeriod(month, now, context.timeZone);
  const sessions = await allRows(
    trusted,
    "class_attendance_sessions",
    "id, session_date, title, occurrence_id",
    (q) =>
      q
        .eq("class_id", context.classId)
        .gte("session_date", `${month}-01`)
        .lt("session_date", calendarDate(period.end, context.timeZone)),
  );
  const ids = sessions.map((row) => text(row.id));
  const occurrenceIds = sessions
    .map((row) => text(row.occurrence_id))
    .filter(Boolean);
  const [records, occurrences, snapshots] = await Promise.all([
    ids.length
      ? allRows(
          trusted,
          "class_attendance_records",
          "id, session_id, status",
          (q) => q.in("session_id", ids).eq("user_id", studentId),
        )
      : [],
    occurrenceIds.length
      ? allRows(
          trusted,
          "lms_lesson_occurrences",
          "id, status, occurrence_date, starts_at",
          (q) =>
            q
              .eq("class_id", context.classId)
              .eq("club_id", context.clubId)
              .in("id", occurrenceIds),
        )
      : [],
    occurrenceIds.length
      ? allRows(
          trusted,
          "lms_occurrence_roster_snapshots",
          "occurrence_id, user_id, enrollment_status",
          (q) => q.eq("user_id", studentId).in("occurrence_id", occurrenceIds),
          "occurrence_id",
        )
      : [],
  ]);
  const selected = selectParentAttendanceSessions({
    sessions,
    records,
    occurrences,
    snapshots,
    membership,
    studentId,
    timeZone: context.timeZone,
    now,
  });
  const present = selected.filter((row) => row.status === "present").length;
  const late = selected.filter((row) => row.status === "late").length;
  const absent = selected.filter((row) => row.status === "absent").length;
  const marked = present + late + absent;
  return {
    sessions: selected,
    present,
    late,
    absent,
    unmarked: selected.length - marked,
    recordedSessions: selected.length,
    markedSessions: marked,
    rate: marked ? (present + late) / marked : null,
    coverage: "recorded_sessions_only" as const,
  };
}
