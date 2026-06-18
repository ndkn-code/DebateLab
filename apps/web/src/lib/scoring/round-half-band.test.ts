import assert from "node:assert/strict";
import { overallBand, roundToHalfBand } from "./round-half-band";

// Nearest half-band: .25 -> .5, .75 -> next whole (IELTS rule).
assert.equal(roundToHalfBand(6.0), 6.0);
assert.equal(roundToHalfBand(6.1), 6.0);
assert.equal(roundToHalfBand(6.24), 6.0);
assert.equal(roundToHalfBand(6.25), 6.5);
assert.equal(roundToHalfBand(6.3), 6.5);
assert.equal(roundToHalfBand(6.74), 6.5);
assert.equal(roundToHalfBand(6.75), 7.0);
assert.equal(roundToHalfBand(6.9), 7.0);
assert.equal(roundToHalfBand(0), 0);

// Guards (these branches must be covered for the scoring/** threshold).
assert.throws(() => roundToHalfBand(Number.NaN), /finite/);
assert.throws(() => roundToHalfBand(Number.POSITIVE_INFINITY), /finite/);
assert.throws(() => roundToHalfBand(-1), /non-negative/);

// Overall = mean of four skills, half-band rounded.
assert.equal(
  overallBand({ listening: 6.5, reading: 6.5, writing: 6.0, speaking: 7.0 }),
  6.5, // mean 6.5
);
assert.equal(
  overallBand({ listening: 6.5, reading: 6.5, writing: 6.5, speaking: 7.0 }),
  6.5, // mean 6.625 -> 6.5
);
assert.equal(
  overallBand({ listening: 7.0, reading: 6.5, writing: 6.5, speaking: 7.0 }),
  7.0, // mean 6.75 -> 7.0
);
assert.equal(
  overallBand({ listening: 6.0, reading: 6.0, writing: 6.5, speaking: 6.5 }),
  6.5, // mean 6.25 -> 6.5
);
assert.equal(
  overallBand({ listening: 8.0, reading: 7.5, writing: 8.0, speaking: 8.5 }),
  8.0, // mean 8.0
);

console.log("scoring/round-half-band tests passed");
