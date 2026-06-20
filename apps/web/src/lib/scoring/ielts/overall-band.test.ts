import assert from "node:assert/strict";
import { computeOverallBand } from "./overall-band";

// ---- All four present: the official overall (mean, half-band rounded) -------
assert.deepEqual(
  computeOverallBand({ listening: 6.5, reading: 6.5, writing: 6.0, speaking: 7.0 }),
  { band: 6.5, isProvisional: false, presentCount: 4 }, // mean 6.5
);
// §6 rounding anchors: .625 -> 6.5, .75 -> 7.0, .25 -> 6.5.
assert.equal(
  computeOverallBand({ listening: 6.5, reading: 6.5, writing: 6.5, speaking: 7.0 }).band,
  6.5, // mean 6.625 -> 6.5
);
assert.equal(
  computeOverallBand({ listening: 7.0, reading: 6.5, writing: 6.5, speaking: 7.0 }).band,
  7.0, // mean 6.75 -> 7.0
);
assert.equal(
  computeOverallBand({ listening: 6.0, reading: 6.0, writing: 6.5, speaking: 6.5 }).band,
  6.5, // mean 6.25 -> 6.5
);
assert.equal(
  computeOverallBand({ listening: 9, reading: 9, writing: 9, speaking: 9 }).band,
  9,
);
assert.equal(
  computeOverallBand({ listening: 0, reading: 0, writing: 0, speaking: 0 }).band,
  0,
);

// ---- Partial: provisional mean of the bands that exist so far ---------------
// R/L only (typical mid-mock: objective graded, W/S still scoring).
assert.deepEqual(
  computeOverallBand({ listening: 7.0, reading: 6.0, writing: null, speaking: null }),
  { band: 6.5, isProvisional: true, presentCount: 2 }, // mean 6.5
);
// Three present.
assert.deepEqual(
  computeOverallBand({ listening: 7.0, reading: 6.0, writing: 6.5, speaking: null }),
  { band: 6.5, isProvisional: true, presentCount: 3 }, // mean 6.5
);
// One present.
assert.deepEqual(
  computeOverallBand({ listening: null, reading: null, writing: null, speaking: 8.0 }),
  { band: 8.0, isProvisional: true, presentCount: 1 },
);

// ---- None present: nothing to score yet ------------------------------------
assert.deepEqual(
  computeOverallBand({ listening: null, reading: null, writing: null, speaking: null }),
  { band: null, isProvisional: true, presentCount: 0 },
);

// ---- Guards (branches required for the scoring/** coverage threshold) -------
assert.throws(
  () => computeOverallBand({ listening: Number.NaN, reading: null, writing: null, speaking: null }),
  /finite/,
);
assert.throws(
  () =>
    computeOverallBand({
      listening: null,
      reading: Number.POSITIVE_INFINITY,
      writing: null,
      speaking: null,
    }),
  /finite/,
);
assert.throws(
  () => computeOverallBand({ listening: null, reading: null, writing: -1, speaking: null }),
  /between 0 and 9/,
);
assert.throws(
  () => computeOverallBand({ listening: null, reading: null, writing: null, speaking: 9.5 }),
  /between 0 and 9/,
);

console.log("scoring/ielts/overall-band tests passed");
