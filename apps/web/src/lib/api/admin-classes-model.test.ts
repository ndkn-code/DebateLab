import assert from "node:assert/strict";
import {
  summarizeAttendanceRecords,
  validateAttendanceSubmission,
} from "./admin-classes-model";

{
  const summary = summarizeAttendanceRecords([
    { status: "present" },
    { status: "present" },
    { status: "late" },
    { status: "absent" },
  ]);

  assert.deepEqual(summary, {
    present: 2,
    late: 1,
    absent: 1,
    total: 4,
    attendanceRate: 75,
  });
}

{
  const validation = validateAttendanceSubmission({
    activeStudentIds: ["student-1", "student-2"],
    assignedCourseIds: ["course-1"],
    courseId: "course-2",
    records: [{ userId: "student-1", status: "present" }],
  });

  assert.equal(validation.ok, false);
  assert.equal(validation.reason, "course_not_assigned");
}

{
  const validation = validateAttendanceSubmission({
    activeStudentIds: ["student-1"],
    assignedCourseIds: ["course-1"],
    courseId: "course-1",
    records: [{ userId: "student-2", status: "late" }],
  });

  assert.equal(validation.ok, false);
  assert.equal(validation.reason, "student_not_in_class");
}

{
  const validation = validateAttendanceSubmission({
    activeStudentIds: ["student-1"],
    assignedCourseIds: ["course-1"],
    courseId: "course-1",
    records: [{ userId: "student-1", status: "present" }],
  });

  assert.deepEqual(validation, { ok: true });
}

console.log("Admin class model tests passed");
