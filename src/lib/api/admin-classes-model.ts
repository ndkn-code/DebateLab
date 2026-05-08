import type {
  AttendanceInputRecord,
  AttendanceStatus,
} from "@/lib/types/admin-classes";

const ATTENDANCE_STATUSES = new Set<AttendanceStatus>([
  "present",
  "late",
  "absent",
]);

export function isAttendanceStatus(value: unknown): value is AttendanceStatus {
  return typeof value === "string" && ATTENDANCE_STATUSES.has(value as AttendanceStatus);
}

export function summarizeAttendanceRecords(
  records: Array<{ status: AttendanceStatus | string | null | undefined }>
) {
  let present = 0;
  let late = 0;
  let absent = 0;

  for (const record of records) {
    if (record.status === "present") present += 1;
    if (record.status === "late") late += 1;
    if (record.status === "absent") absent += 1;
  }

  const total = present + late + absent;
  const attendanceRate = total > 0
    ? Math.round(((present + late) / total) * 100)
    : null;

  return { present, late, absent, total, attendanceRate };
}

export function validateAttendanceSubmission({
  activeStudentIds,
  assignedCourseIds,
  courseId,
  records,
}: {
  activeStudentIds: Iterable<string>;
  assignedCourseIds: Iterable<string>;
  courseId: string;
  records: AttendanceInputRecord[];
}) {
  const studentIds = new Set(activeStudentIds);
  const courseIds = new Set(assignedCourseIds);

  if (!courseIds.has(courseId)) {
    return { ok: false as const, reason: "course_not_assigned" as const };
  }

  if (records.length === 0) {
    return { ok: false as const, reason: "no_records" as const };
  }

  for (const record of records) {
    if (!studentIds.has(record.userId)) {
      return {
        ok: false as const,
        reason: "student_not_in_class" as const,
        userId: record.userId,
      };
    }

    if (!isAttendanceStatus(record.status)) {
      return {
        ok: false as const,
        reason: "invalid_status" as const,
        userId: record.userId,
      };
    }
  }

  return { ok: true as const };
}
