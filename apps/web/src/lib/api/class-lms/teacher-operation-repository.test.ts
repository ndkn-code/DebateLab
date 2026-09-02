import assert from "node:assert/strict";
import test from "node:test";
import {
  studentWeekInputSchema,
  teacherAnnouncementSchema,
  teacherAttendanceCorrectionSchema,
  teacherHomeworkGradeSchema,
  teacherLessonPlanSchema,
  teacherMaterialPlacementSchema,
  teacherMaterialRightsSchema,
  teacherOccurrenceStateSchema,
  teacherPublishAssignmentSchema,
  teacherRescheduleSchema,
  teacherReviewQueueInputSchema,
  teacherReviewOverrideSchema,
} from "./teacher-operation-repository";

const id = "00000000-0000-4000-8000-000000000001";
const other = "00000000-0000-4000-8000-000000000002";
const updated = "2026-09-02T12:00:00.000Z";
const key = "teacher-operation-001";

test("strict operation schemas require concurrency and idempotency fields", () => {
  const base = { scheduleId: id, startDate: "2026-09-02", endDate: "2026-09-02", startTime: "09:00", endTime: "10:00", timezone: "Asia/Ho_Chi_Minh", expectedUpdatedAt: updated, idempotencyKey: key };
  assert.equal(teacherRescheduleSchema.parse(base).idempotencyKey, key);
  assert.equal(teacherRescheduleSchema.safeParse({ ...base, idempotencyKey: undefined }).success, false);
  assert.equal(teacherRescheduleSchema.safeParse({ ...base, unexpected: true }).success, false);
  assert.equal(teacherOccurrenceStateSchema.safeParse({ occurrenceId: id, state: "completed", expectedUpdatedAt: updated, idempotencyKey: key }).success, true);
  assert.equal(teacherOccurrenceStateSchema.safeParse({ occurrenceId: id, state: "unknown", expectedUpdatedAt: updated, idempotencyKey: key }).success, false);
});

test("lesson, assignment, attendance, and grading contracts reject invalid transitions", () => {
  assert.equal(teacherLessonPlanSchema.safeParse({ classId: id, courseId: other, occurrenceDate: "2026-09-02", startsAt: updated, endsAt: updated, timezone: "UTC", title: "Lesson", idempotencyKey: key }).success, false);
  assert.equal(teacherLessonPlanSchema.safeParse({ classId: id, courseId: other, scheduleId: id, lessonId: id, occurrenceDate: "2026-09-02", startsAt: updated, endsAt: updated, timezone: "UTC", title: "Lesson", idempotencyKey: key }).success, true);
  assert.equal(teacherPublishAssignmentSchema.safeParse({ assignmentId: id, expectedUpdatedAt: updated, idempotencyKey: key }).success, true);
  assert.equal(teacherAttendanceCorrectionSchema.safeParse({ sessionId: id, userId: other, status: "present", idempotencyKey: key }).success, true);
  assert.equal(teacherAttendanceCorrectionSchema.safeParse({ sessionId: id, userId: other, status: "excused", idempotencyKey: key }).success, false);
  assert.equal(teacherHomeworkGradeSchema.safeParse({ submissionId: id, score: 8, scoreMax: 10, expectedUpdatedAt: updated, idempotencyKey: key }).success, true);
  assert.equal(teacherHomeworkGradeSchema.safeParse({ submissionId: id, score: 11, scoreMax: 10, expectedUpdatedAt: updated, idempotencyKey: key }).success, false);
});

test("announcement, review override, and student-week contracts preserve scoped identifiers", () => {
  assert.equal(teacherAnnouncementSchema.parse({ classId: id, title: "Update", body: "Please review this week's work.", idempotencyKey: key }).publish, false);
  assert.equal(teacherReviewOverrideSchema.safeParse({ reviewId: id, reason: "Lead teacher unavailable", idempotencyKey: key }).success, true);
  assert.equal(teacherReviewOverrideSchema.safeParse({ reviewId: id, reason: " ", idempotencyKey: key }).success, false);
  assert.equal(studentWeekInputSchema.safeParse({ classId: id, from: "2026-09-01", to: "2026-09-07" }).success, true);
  assert.equal(studentWeekInputSchema.safeParse({ classId: id, from: "09/01/2026", to: "2026-09-07" }).success, false);
  assert.equal(teacherReviewQueueInputSchema.safeParse({ classId: id, cursor: { submittedAt: updated, itemId: other }, limit: 25 }).success, true);
  assert.equal(teacherReviewQueueInputSchema.safeParse({ classId: id, cursor: updated, limit: 25 }).success, false);
});

test("material wrappers keep placement targets and rights boundaries strict", () => {
  const placement = { materialId: id, versionId: other, targetType: "class", classId: id, status: "draft", required: false, orderIndex: 0, audienceUserIds: [], rules: [], idempotencyKey: key };
  assert.equal(teacherMaterialPlacementSchema.safeParse(placement).success, true);
  assert.equal(teacherMaterialPlacementSchema.safeParse({ ...placement, courseId: other }).success, false);
  assert.equal(teacherMaterialRightsSchema.safeParse({ materialId: id, versionId: other, rights: { basis: "original" }, idempotencyKey: key }).success, true);
  assert.equal(teacherMaterialRightsSchema.safeParse({ materialId: id, versionId: other, rights: { basis: "open_license", sourceUrl: "not-a-url" }, idempotencyKey: key }).success, false);
});
