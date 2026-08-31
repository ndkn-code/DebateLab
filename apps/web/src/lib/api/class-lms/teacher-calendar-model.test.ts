import assert from "node:assert/strict";
import {
  expandTeacherScheduleOccurrences,
  normalizeTeacherCalendarPreferences,
  normalizeTeacherCalendarRange,
  sortTeacherCalendarEvents,
  zonedWallClockToUtc,
  type TeacherCalendarEvent,
} from "./teacher-calendar-model";
import type { ClassRecurrenceRule } from "../admin-class-schedules-model";

const source = {
  id: "schedule-1",
  startDate: "2026-03-01",
  endDate: "2026-03-31",
  startTime: "09:00:00",
  endTime: "10:30:00",
  timezone: "America/New_York",
  recurrenceRule: {
    frequency: "weekly",
    interval: 1,
    weekdays: ["SU", "MO"],
    endMode: "never",
    until: null,
    count: null,
  } satisfies ClassRecurrenceRule,
};

assert.deepEqual(
  expandTeacherScheduleOccurrences(source, "2026-03-01", "2026-03-31").map(
    (item) => item.date,
  ),
  [
    "2026-03-01",
    "2026-03-02",
    "2026-03-08",
    "2026-03-09",
    "2026-03-15",
    "2026-03-16",
    "2026-03-22",
    "2026-03-23",
    "2026-03-29",
    "2026-03-30",
  ],
);
assert.equal(
  zonedWallClockToUtc("2026-03-08", "09:00:00", "America/New_York"),
  "2026-03-08T13:00:00.000Z",
);
assert.equal(
  zonedWallClockToUtc("2026-03-08", "03:30:00", "America/New_York"),
  "2026-03-08T07:30:00.000Z",
);
assert.equal(
  zonedWallClockToUtc("2026-11-01", "02:30:00", "America/New_York"),
  "2026-11-01T07:30:00.000Z",
);
assert.equal(
  zonedWallClockToUtc("2026-03-09", "09:00:00", "America/New_York"),
  "2026-03-09T13:00:00.000Z",
);
assert.equal(
  zonedWallClockToUtc("2026-03-02", "09:00:00", "Asia/Ho_Chi_Minh"),
  "2026-03-02T02:00:00.000Z",
);
assert.throws(
  () => zonedWallClockToUtc("2026-03-08", "02:30:00", "America/New_York"),
  /does not exist/,
);

const bounded = normalizeTeacherCalendarRange({
  view: "month",
  anchorDate: "2026-02-12",
  timezone: "Asia/Ho_Chi_Minh",
});
assert.deepEqual(bounded, {
  startDate: "2026-02-01",
  endDate: "2026-02-28",
  view: "month",
  timezone: "Asia/Ho_Chi_Minh",
});
assert.equal(
  normalizeTeacherCalendarRange({
    view: "week",
    anchorDate: "2026-02-12",
    weekStart: 0,
  }).startDate,
  "2026-02-08",
);
assert.throws(
  () =>
    normalizeTeacherCalendarRange({
      startDate: "2026-01-01",
      endDate: "2026-04-01",
    }),
  /at most 62/,
);
assert.equal(
  normalizeTeacherCalendarPreferences({
    view: "agenda",
    weekStart: 0,
    timezone: "not/a-timezone",
  }).timezone,
  "Asia/Ho_Chi_Minh",
);
assert.equal(
  normalizeTeacherCalendarPreferences({
    timezoneMode: "fixed",
    timezone: "America/New_York",
  }).timezoneMode,
  "fixed",
);
assert.deepEqual(
  normalizeTeacherCalendarPreferences({
    workingHours: { start: "bad", end: "25:00" },
  }).workingHours,
  { start: "08:00", end: "20:00" },
);

const event = (
  id: string,
  startsAt: string,
  endsAt: string,
  classTitle: string,
): TeacherCalendarEvent => ({
  id,
  scheduleId: id,
  occurrenceId: null,
  classId: id,
  classTitle,
  programType: "debate",
  courseId: null,
  courseTitle: null,
  lessonId: null,
  lessonTitle: null,
  title: classTitle,
  date: "2026-03-01",
  startsAt,
  endsAt,
  timezone: "UTC",
  status: "scheduled",
  scheduleStatus: "active",
  location: null,
  room: null,
  meetingUrl: null,
  attendanceState: null,
  counts: { assignmentCount: 0, submissionCount: 0, reviewCount: 0 },
  colorToken: "blue",
  actions: {
    viewClass: true,
    takeAttendance: true,
    reviewHomework: true,
    viewGradebook: true,
    planLesson: true,
    manageMaterials: true,
    postAnnouncement: true,
    reschedule: true,
    cancel: true,
    complete: true,
  },
});
assert.deepEqual(
  sortTeacherCalendarEvents([
    event("z", "2026-03-01T10:00:00.000Z", "2026-03-01T11:00:00.000Z", "Zeta"),
    event("a", "2026-03-01T09:00:00.000Z", "2026-03-01T10:00:00.000Z", "Alpha"),
    event("b", "2026-03-01T09:00:00.000Z", "2026-03-01T10:00:00.000Z", "Beta"),
  ]).map((item) => item.id),
  ["a", "b", "z"],
);

console.log("Teacher calendar model tests passed");
