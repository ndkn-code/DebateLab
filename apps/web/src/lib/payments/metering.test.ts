import assert from "node:assert/strict";
import {
  limitFor,
  METERED_FEATURES,
  monthlyWindow,
  weeklyWindow,
  windowFor,
} from "./metering";

// Monthly window: first of this month -> first of next month (UTC).
const mid = new Date("2026-06-19T13:45:00Z");
const mw = monthlyWindow(mid);
assert.equal(mw.start.toISOString(), "2026-06-01T00:00:00.000Z");
assert.equal(mw.end.toISOString(), "2026-07-01T00:00:00.000Z");

// December rolls into next year.
const dec = monthlyWindow(new Date("2026-12-15T00:00:00Z"));
assert.equal(dec.end.toISOString(), "2027-01-01T00:00:00.000Z");

// Weekly window anchored to Monday. 2026-06-19 is a Friday -> Monday 2026-06-15.
const ww = weeklyWindow(mid);
assert.equal(ww.start.toISOString(), "2026-06-15T00:00:00.000Z");
assert.equal(ww.end.toISOString(), "2026-06-22T00:00:00.000Z");
// A Monday maps to itself.
const mon = weeklyWindow(new Date("2026-06-15T09:00:00Z"));
assert.equal(mon.start.toISOString(), "2026-06-15T00:00:00.000Z");
// A Sunday maps back to the prior Monday.
const sun = weeklyWindow(new Date("2026-06-21T23:00:00Z"));
assert.equal(sun.start.toISOString(), "2026-06-15T00:00:00.000Z");

// windowFor dispatches by feature period.
assert.equal(
  windowFor(METERED_FEATURES.aiWritingScore, mid).start.toISOString(),
  "2026-06-01T00:00:00.000Z",
);
assert.equal(
  windowFor(METERED_FEATURES.bandPrediction, mid).start.toISOString(),
  "2026-06-15T00:00:00.000Z",
);

// Limits: free is capped, premium is uncapped (null).
assert.equal(limitFor("free", METERED_FEATURES.aiWritingScore), 3);
assert.equal(limitFor("free", METERED_FEATURES.fullMockTest), 1);
assert.equal(limitFor("free", METERED_FEATURES.bandPrediction), 1);
assert.equal(limitFor("premium", METERED_FEATURES.aiWritingScore), null);
assert.equal(limitFor("enterprise", METERED_FEATURES.fullMockTest), null);

console.log("payments/metering tests passed");
