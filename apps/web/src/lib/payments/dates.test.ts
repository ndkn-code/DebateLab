import assert from "node:assert/strict";
import { addMonths } from "./dates";

assert.equal(
  addMonths(new Date("2026-06-19T00:00:00Z"), 1).toISOString(),
  "2026-07-19T00:00:00.000Z",
);
assert.equal(
  addMonths(new Date("2026-06-19T00:00:00Z"), 3).toISOString(),
  "2026-09-19T00:00:00.000Z",
);
assert.equal(
  addMonths(new Date("2026-06-19T00:00:00Z"), 12).toISOString(),
  "2027-06-19T00:00:00.000Z",
);
// Year rollover.
assert.equal(
  addMonths(new Date("2026-12-15T00:00:00Z"), 1).toISOString(),
  "2027-01-15T00:00:00.000Z",
);

console.log("payments/dates tests passed");
