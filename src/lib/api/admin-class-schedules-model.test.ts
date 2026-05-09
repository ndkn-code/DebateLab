import assert from "node:assert/strict";
import {
  buildClassCodeCandidate,
  expandScheduleOccurrences,
  isScheduleCourseAllowed,
  isValidProgramLevel,
  normalizeClassLevel,
  normalizeRecurrenceRule,
  summarizeRecurrence,
} from "./admin-class-schedules-model";

assert.equal(buildClassCodeCandidate("debate", 0, new Date("2026-05-08T00:00:00Z"), "ABC123"), "DEB-2026-ABC123");
assert.equal(buildClassCodeCandidate("debate", 1, new Date("2026-05-08T00:00:00Z"), "ABC123"), "DEB-2026-ABC123-2");
assert.equal(buildClassCodeCandidate("ielts", 0, new Date("2026-05-08T00:00:00Z"), "BAND8"), "IELTS-2026-BAND8");

assert.equal(isValidProgramLevel("debate", "Beginner"), true);
assert.equal(isValidProgramLevel("debate", "Band 5-6"), false);
assert.equal(isValidProgramLevel("ielts", "Band 6.5-7.5"), true);
assert.equal(isValidProgramLevel("public_speaking", "Advanced"), true);
assert.equal(normalizeClassLevel("ielts", "unknown"), "Foundation");
assert.equal(normalizeClassLevel("public_speaking", "advanced"), "Advanced");

const weeklyRule = normalizeRecurrenceRule({
  frequency: "weekly",
  interval: 1,
  weekdays: ["MO", "WE"],
  endMode: "on_date",
  until: "2026-05-20",
}, "2026-05-04");

assert.deepEqual(
  expandScheduleOccurrences({
    id: "weekly",
    startDate: "2026-05-04",
    endDate: "2026-05-20",
    startTime: "16:00:00",
    endTime: "17:30:00",
    recurrenceRule: weeklyRule,
  }, "2026-05-01", "2026-05-31").map((item) => item.date),
  ["2026-05-04", "2026-05-06", "2026-05-11", "2026-05-13", "2026-05-18", "2026-05-20"]
);

const dailyRule = normalizeRecurrenceRule({
  frequency: "daily",
  interval: 2,
  endMode: "after_occurrences",
  count: 3,
}, "2026-05-01");

assert.deepEqual(
  expandScheduleOccurrences({
    id: "daily",
    startDate: "2026-05-01",
    endDate: null,
    startTime: "09:00:00",
    endTime: "10:00:00",
    recurrenceRule: dailyRule,
  }, "2026-05-01", "2026-05-31").map((item) => item.date),
  ["2026-05-01", "2026-05-03", "2026-05-05"]
);

const monthlyRule = normalizeRecurrenceRule({
  frequency: "monthly",
  interval: 1,
  endMode: "after_occurrences",
  count: 3,
}, "2026-01-15");

assert.deepEqual(
  expandScheduleOccurrences({
    id: "monthly",
    startDate: "2026-01-15",
    endDate: null,
    startTime: "12:00:00",
    endTime: "13:00:00",
    recurrenceRule: monthlyRule,
  }, "2026-01-01", "2026-04-30").map((item) => item.date),
  ["2026-01-15", "2026-02-15", "2026-03-15"]
);

const onceRule = normalizeRecurrenceRule({ frequency: "none" }, "2026-05-08");
assert.deepEqual(
  expandScheduleOccurrences({
    id: "once",
    startDate: "2026-05-08",
    endDate: null,
    startTime: "14:00:00",
    endTime: "15:00:00",
    recurrenceRule: onceRule,
  }, "2026-05-01", "2026-05-31").map((item) => item.date),
  ["2026-05-08"]
);

assert.equal(summarizeRecurrence(weeklyRule, "2026-05-04").includes("Weekly on Mon, Wed"), true);
assert.equal(isScheduleCourseAllowed(null, []), true);
assert.equal(isScheduleCourseAllowed("course-a", ["course-a"]), true);
assert.equal(isScheduleCourseAllowed("course-b", ["course-a"]), false);

console.log("Admin class schedule model tests passed");
