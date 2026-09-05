import "server-only";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import { isIeltsAccessible } from "@/lib/ielts/access";
import {
  resolveTeacherWorkspaceClassFeature,
  TEACHER_WORKSPACE_COMPATIBLE_FEATURE_KEYS,
} from "@/lib/api/class-lms/teacher-workspace-capability";
import { buildCentreAnalytics } from "@/lib/analytics/centre-rollup";
import type {
  CentreAnalytics,
  CentreClassFact,
} from "@/lib/analytics/contracts";
import {
  createTypedServerClient,
  requireAnalyticsCentre,
  centreTimezone,
} from "./access";
import { reportingPeriod, dateInZone } from "./reporting-period";
import { readPages, readChunkedPages, requireRows } from "./query-pages";
import { normalizeCentreOperations } from "./centre-operations";
import { loadCentreIeltsEvents } from "./centre-scoring";

/** One centre capability; no per-teacher queries and no sums of overlapping rosters. */
export async function loadCentreAnalytics(
  clubId: string,
  days: 7 | 30 | 90,
): Promise<CentreAnalytics & { viewerId: string }> {
  const db = await createTypedServerClient();
  const viewerId = await requireAnalyticsCentre(db, clubId);
  const period = reportingPeriod(days, await centreTimezone(db, clubId));
  const classRows = requireRows(
    await readPages((from, to) =>
      db
        .from("classes")
        .select("id,title,program_type,status")
        .eq("club_id", clubId)
        .order("id")
        .range(from, to),
    ),
    "classes",
  );
  const classIds = classRows.map((row) => row.id);
  const [
    membersResult,
    occurrencesResult,
    sessionsResult,
    submissionsResult,
    flagsResult,
  ] = await Promise.all([
    readChunkedPages([classIds], (chunks, from, to) =>
      db
        .from("class_memberships")
        .select("class_id,user_id,member_role,status")
        .in("class_id", chunks[0])
        .eq("status", "active")
        .order("id")
        .range(from, to),
    ),
    readChunkedPages([classIds], (chunks, from, to) =>
      db
        .from("lms_lesson_occurrences")
        .select("id,class_id,starts_at,status")
        .eq("club_id", clubId)
        .in("class_id", chunks[0])
        .gte("starts_at", period.start)
        .lte("starts_at", period.end)
        .order("id")
        .range(from, to),
    ),
    readChunkedPages([classIds], (chunks, from, to) =>
      db
        .from("class_attendance_sessions")
        .select("id,class_id,session_date,occurrence_id,taken_by")
        .in("class_id", chunks[0])
        .gte("session_date", dateInZone(period.start, period.timezone))
        .lte("session_date", dateInZone(period.end, period.timezone))
        .order("id")
        .range(from, to),
    ),
    readChunkedPages([classIds], (chunks, from, to) =>
      db
        .from("club_assignment_submissions")
        .select(
          "id,class_id,user_id,assignment_id,revision_number,submission_state,grade_status,submitted_at",
        )
        .eq("club_id", clubId)
        .in("class_id", chunks[0])
        .eq("submission_state", "submitted")
        .lte("submitted_at", period.end)
        .order("id")
        .range(from, to),
    ),
    readPages((from, to) =>
      db
        .from("lms_pilot_flags")
        .select("club_id,class_id,feature_key,enabled")
        .eq("club_id", clubId)
        .in("feature_key", [...TEACHER_WORKSPACE_COMPATIBLE_FEATURE_KEYS])
        .order("id")
        .range(from, to),
    ),
  ]);
  const members = requireRows(membersResult, "memberships");
  const occurrences = requireRows(occurrencesResult, "occurrences");
  const sessions = requireRows(sessionsResult, "attendance sessions");
  const submissions = requireRows(submissionsResult, "submissions");
  const flags = requireRows(flagsResult, "pilot flags");
  const [attendanceResult, gradeEventsResult] = await Promise.all([
    readChunkedPages([sessions.map((row) => row.id)], (chunks, from, to) =>
      db
        .from("class_attendance_records")
        .select("id,session_id,user_id,status")
        .in("session_id", chunks[0])
        .order("id")
        .range(from, to),
    ),
    readChunkedPages([submissions.map((row) => row.id)], (chunks, from, to) =>
      db
        .from("club_assignment_grade_events")
        .select(
          "id,submission_id,revision_number,created_at,graded_by,grade_status",
        )
        .in("submission_id", chunks[0])
        .lte("created_at", period.end)
        .order("created_at")
        .order("id")
        .range(from, to),
    ),
  ]);
  const attendance = requireRows(attendanceResult, "attendance");
  const gradeEvents = requireRows(gradeEventsResult, "feedback");
  const events = normalizeCentreOperations({
    period,
    occurrences,
    sessions,
    attendance,
    submissions,
    gradeEvents,
  });
  const ieltsVisible = await isIeltsAccessible();
  const ieltsClassIds = ieltsVisible
    ? classRows
        .filter((row) =>
          resolveTeacherWorkspaceClassFeature({
            flags,
            organizationId: clubId,
            classId: row.id,
            programType: row.program_type === "ielts" ? "ielts" : "debate",
          }),
        )
        .map((row) => row.id)
    : [];
  // Service role remains restricted to response IDs read through the authorized centre below.
  if (ieltsClassIds.length)
    events.push(
      ...(await loadCentreIeltsEvents(
        db,
        createTypedAdminClient(),
        clubId,
        ieltsClassIds,
        period,
      )),
    );
  const classes: CentreClassFact[] = classRows.map((row) => ({
    classId: row.id,
    title: row.title,
    teacherIds: members
      .filter(
        (member) =>
          member.class_id === row.id && member.member_role === "teacher",
      )
      .map((member) => member.user_id),
    activeLearnerIds: members
      .filter(
        (member) =>
          member.class_id === row.id && member.member_role === "student",
      )
      .map((member) => member.user_id),
  }));
  const teacherIds = [
    ...new Set([
      ...classes.flatMap((row) => row.teacherIds),
      ...events.flatMap((event) => (event.teacherId ? [event.teacherId] : [])),
    ]),
  ];
  // These identity IDs come only from centre-scoped memberships or grade actors.
  const profiles = teacherIds.length
    ? requireRows(
        await readChunkedPages([teacherIds], (chunks, from, to) =>
          createTypedAdminClient()
            .from("profiles")
            .select("id,display_name")
            .in("id", chunks[0])
            .order("id")
            .range(from, to),
        ),
        "teacher profiles",
      )
    : [];
  const report = buildCentreAnalytics({
    clubId,
    viewerId,
    period,
    events,
    classes,
    sources: {
      operations: "available",
      ielts: ieltsVisible ? "available" : "unavailable",
    },
  });
  // Only normalized identity labels and aggregates cross the action boundary.
  return {
    ...report,
    viewerId,
    teacherNames: Object.fromEntries(
      profiles.map((row) => [row.id, row.display_name ?? ""]),
    ),
  };
}
