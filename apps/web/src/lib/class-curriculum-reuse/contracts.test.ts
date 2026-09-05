import assert from "node:assert/strict";
import { test } from "node:test";
import {
  reuseInputSchema,
  reuseDatesSchema,
  reuseErrorCode,
  validCalendarDate,
} from "./contracts";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const input = {
  sourceClassId: id,
  title: " New cohort ",
  startDate: "2026-09-05",
  endDate: null,
  dateMode: "clear",
  timezone: "Asia/Ho_Chi_Minh",
  courseIds: [id],
  materialPlacementIds: [],
  assignmentIds: [],
  previewFingerprint: "revision",
  idempotencyKey: id,
};
test("calendar dates reject normalization, timestamps and impossible days", () => {
  for (const date of [
    "2026-02-29",
    "2026-04-31",
    "2026-9-05",
    "2026-09-05T00:00:00Z",
    "tomorrow",
  ])
    assert.equal(validCalendarDate(date), false);
  assert.equal(validCalendarDate("2024-02-29"), true);
});
test("bounded strict request excludes learner or destination overrides", () => {
  assert.equal(reuseInputSchema.parse(input).title, "New cohort");
  for (const field of [
    "clubId",
    "studentIds",
    "status",
    "publishedAt",
    "metadata",
  ])
    assert.equal(
      reuseInputSchema.safeParse({ ...input, [field]: "override" }).success,
      false,
    );
});
test("duplicate selections, reversed dates and invalid timezone fail before RPC", () => {
  for (const extra of [
    { assignmentIds: [id, id] },
    { courseIds: Array(201).fill(id) },
    { endDate: "2026-09-04" },
    { timezone: "Mars/Olympus" },
    { title: " " },
  ])
    assert.equal(
      reuseInputSchema.safeParse({ ...input, ...extra }).success,
      false,
    );
});
test("review shares the exact date and selection contract", () => {
  const {
    startDate,
    endDate,
    dateMode,
    timezone,
    materialPlacementIds,
    assignmentIds,
  } = reuseInputSchema.parse(input);
  assert.deepEqual(
    reuseDatesSchema.parse({
      startDate,
      endDate,
      dateMode,
      timezone,
      materialPlacementIds,
      assignmentIds,
    }),
    {
      startDate,
      endDate,
      dateMode,
      timezone,
      materialPlacementIds,
      assignmentIds,
    },
  );
});
test("database messages never expose raw internals to UI", () => {
  assert.equal(
    reuseErrorCode(new Error("table customer_secrets not found")),
    "REUSE_FAILED",
  );
  assert.equal(
    reuseErrorCode(new Error("REUSE_SOURCE_CHANGED")),
    "REUSE_SOURCE_CHANGED",
  );
  assert.equal(reuseErrorCode(new Error("FORBIDDEN")), "REUSE_FORBIDDEN");
});
