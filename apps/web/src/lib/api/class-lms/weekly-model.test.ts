import assert from "node:assert/strict";
import test from "node:test";
import {
  addIsoDateDays,
  dateKeyInTimezone,
  weekStartForTimezone,
} from "./weekly-model";

test("normalizes an explicit date to its Monday", () => {
  assert.equal(weekStartForTimezone("2026-08-30", "UTC"), "2026-08-24");
  assert.equal(weekStartForTimezone("2026-08-26", "UTC"), "2026-08-24");
});

test("uses the learner or club timezone at the Sunday/Monday boundary", () => {
  const instant = new Date("2026-03-09T00:30:00Z");
  assert.equal(dateKeyInTimezone(instant, "America/New_York"), "2026-03-08");
  assert.equal(
    weekStartForTimezone(undefined, "America/New_York", instant),
    "2026-03-02",
  );
  assert.equal(dateKeyInTimezone(instant, "Asia/Ho_Chi_Minh"), "2026-03-09");
  assert.equal(
    weekStartForTimezone(undefined, "Asia/Ho_Chi_Minh", instant),
    "2026-03-09",
  );
});

test("calendar-day arithmetic is stable through daylight-saving changes", () => {
  assert.equal(addIsoDateDays("2026-03-08", 1), "2026-03-09");
  assert.equal(addIsoDateDays("2026-11-01", 1), "2026-11-02");
});

test("rejects malformed date input", () => {
  assert.throws(() => weekStartForTimezone("08/30/2026", "UTC"));
  assert.throws(() => addIsoDateDays("tomorrow", 1));
});
