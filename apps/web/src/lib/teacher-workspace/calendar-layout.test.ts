import assert from "node:assert/strict";
import type { TeacherCalendarEvent } from "@/lib/api/class-lms/teacher-calendar-model";
import {
  calendarEventGeometry,
  layoutTeacherEventLanes,
} from "./calendar-layout";

const base = {
  scheduleId: "s",
  scheduleUpdatedAt: "2026-08-30T12:00:00.000Z",
  occurrenceUpdatedAt: "2026-08-30T12:00:00.000Z",
  expectedUpdatedAt: "2026-08-30T12:00:00.000Z",
  occurrenceId: "o",
  classId: "c",
  classTitle: "Class",
  programType: "ielts",
  courseId: null,
  courseTitle: null,
  lessonId: null,
  lessonTitle: null,
  date: "2026-08-31",
  timezone: "America/New_York",
  status: "scheduled",
  scheduleStatus: "active",
  location: null,
  room: null,
  meetingUrl: null,
  attendanceState: null,
  counts: { assignmentCount: 0, submissionCount: 0, reviewCount: 0 },
  colorToken: "teal",
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
} satisfies Omit<TeacherCalendarEvent, "id" | "title" | "startsAt" | "endsAt">;

const item = (
  id: string,
  startsAt: string,
  endsAt: string,
): TeacherCalendarEvent => ({
  ...base,
  id,
  title: id,
  startsAt,
  endsAt,
});

const lanes = layoutTeacherEventLanes(
  [
    item("b", "2026-08-31T13:30:00.000Z", "2026-08-31T15:00:00.000Z"),
    item("a", "2026-08-31T13:00:00.000Z", "2026-08-31T14:15:00.000Z"),
    item("c", "2026-08-31T14:30:00.000Z", "2026-08-31T15:30:00.000Z"),
  ],
  "America/New_York",
);
assert.deepEqual(
  lanes.map((entry) => [entry.event.id, entry.lane, entry.laneCount]),
  [
    ["a", 0, 2],
    ["b", 1, 2],
    ["c", 0, 2],
  ],
);
assert.deepEqual(
  calendarEventGeometry({
    startMinute: 9 * 60 + 30,
    endMinute: 11 * 60,
    gridStartMinute: 8 * 60,
    gridEndMinute: 20 * 60,
    hourHeight: 64,
  }),
  { top: 96, height: 96 },
);

console.log("Teacher calendar layout tests passed");
