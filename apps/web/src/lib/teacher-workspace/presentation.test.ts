import assert from "node:assert/strict";
import test from "node:test";
import { buildTeacherWorkspaceDemoPresentation } from "./presentation";

test("demo calendar fixtures are constrained to the requested presentation range", () => {
  const currentWeek = buildTeacherWorkspaceDemoPresentation({
    locale: "en",
    surface: "calendar",
    range: {
      startDate: "2026-08-31",
      endDate: "2026-09-06",
      view: "agenda",
      timezone: "America/New_York",
    },
  });
  const previousWeek = buildTeacherWorkspaceDemoPresentation({
    locale: "en",
    surface: "calendar",
    range: {
      startDate: "2026-08-24",
      endDate: "2026-08-30",
      view: "agenda",
      timezone: "America/New_York",
    },
  });

  assert.equal(currentWeek.calendar.events.length, 10);
  assert.equal(previousWeek.calendar.events.length, 0);
  assert.deepEqual(previousWeek.eventDetails, {});
  assert.equal(previousWeek.calendar.range.startDate, "2026-08-24");
});

test("demo event details preserve permitted action destinations", () => {
  const presentation = buildTeacherWorkspaceDemoPresentation({
    locale: "en",
    surface: "calendar",
    range: {
      startDate: "2026-08-31",
      endDate: "2026-09-06",
      view: "week",
      timezone: "America/New_York",
    },
  });
  const event = presentation.calendar.events[0];
  const detail = presentation.eventDetails[event.id];

  assert.equal(
    detail.actionUrls.viewClass,
    `/dashboard/teacher/classes/${event.classId}`,
  );
  assert.match(detail.actionUrls.takeAttendance ?? "", /tab=attendance/);
  assert.match(detail.actionUrls.planLesson ?? "", /tab=lessons/);
  assert.match(detail.actionUrls.manageMaterials ?? "", /teacher\/materials/);
});
