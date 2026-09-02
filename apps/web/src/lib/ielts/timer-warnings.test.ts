import assert from "node:assert/strict";
import { formatWarningMinutes, nextTimerWarning, warningMinutes } from "./timer-warnings";

const thresholds = [10 * 60, 5 * 60];

// Simulated 1 Hz countdown from 11:00 fires 600 once and 300 once.
{
  const fired: number[] = [];
  const log: Array<[number, number]> = [];
  for (let remaining = 660; remaining >= 0; remaining -= 1) {
    const warning = nextTimerWarning(remaining, thresholds, fired);
    if (warning !== null) {
      fired.push(warning);
      log.push([remaining, warning]);
    }
  }
  assert.deepEqual(log, [[600, 600], [300, 300]]);
}

// A missed tick (601 → 599) still fires 600 exactly once.
{
  const fired: number[] = [];
  assert.equal(nextTimerWarning(601, thresholds, fired), null);
  assert.equal(nextTimerWarning(599, thresholds, fired), 600);
  fired.push(600);
  assert.equal(nextTimerWarning(598, thresholds, fired), null);
}

// Resume at 4:00 fires only 300 (600 is stale, never announced late).
{
  const fired: number[] = [];
  assert.equal(nextTimerWarning(240, thresholds, fired), 300);
  fired.push(300);
  assert.equal(nextTimerWarning(239, thresholds, fired), null);
  assert.equal(nextTimerWarning(10, thresholds, fired), null);
}

// No refire once fired; nothing at/below zero; empty thresholds (practice) → null.
assert.equal(nextTimerWarning(300, thresholds, [300]), null);
assert.equal(nextTimerWarning(0, thresholds, []), null);
assert.equal(nextTimerWarning(-5, thresholds, []), null);
assert.equal(nextTimerWarning(120, [], []), null);
assert.equal(nextTimerWarning(120, [0, -1, Number.NaN], []), null);
// Order of thresholds does not matter.
assert.equal(nextTimerWarning(500, [300, 600], []), 600);

assert.equal(warningMinutes(600), 10);
assert.equal(warningMinutes(90), 2);
assert.equal(formatWarningMinutes(600), "10:00");
assert.equal(formatWarningMinutes(300), "5:00");
assert.equal(formatWarningMinutes(30), "0:30");
assert.equal(formatWarningMinutes(65), "1:05");

console.log("timer-warnings.test.ts ok");
