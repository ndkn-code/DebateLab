import assert from "node:assert/strict";
import {
  SPEAKING_CRITERIA,
  attemptSpeakingBand,
  snapToHalfBand,
  speakingBandFromCriteria,
  type SpeakingCriteriaBands,
} from "./band-math";

function bands(
  fluencyCoherence: number,
  lexicalResource: number,
  grammaticalRangeAccuracy: number,
  pronunciation: number,
): SpeakingCriteriaBands {
  return {
    fluencyCoherence,
    lexicalResource,
    grammaticalRangeAccuracy,
    pronunciation,
  };
}

// --- SPEAKING_CRITERIA ------------------------------------------------------
assert.deepEqual(SPEAKING_CRITERIA, [
  "fluencyCoherence",
  "lexicalResource",
  "grammaticalRangeAccuracy",
  "pronunciation",
]);

// --- snapToHalfBand ---------------------------------------------------------
assert.equal(snapToHalfBand(6.5), 6.5);
assert.equal(snapToHalfBand(6.4), 6.5); // 6.4 -> nearest half 6.5
assert.equal(snapToHalfBand(6.2), 6.0); // 6.2 -> 6.0
assert.equal(snapToHalfBand(6.25), 6.5); // tie rounds up
assert.equal(snapToHalfBand(7.74), 7.5);
assert.equal(snapToHalfBand(7.75), 8.0); // .75 -> next whole
assert.equal(snapToHalfBand(0), 0);
assert.equal(snapToHalfBand(9), 9);
// clamping out-of-range model output (both min + max branches)
assert.equal(snapToHalfBand(-3), 0);
assert.equal(snapToHalfBand(12.4), 9);
// guard
assert.throws(() => snapToHalfBand(Number.NaN), /finite/);
assert.throws(() => snapToHalfBand(Number.POSITIVE_INFINITY), /finite/);

// --- speakingBandFromCriteria -----------------------------------------------
// mean exactly on a whole band
assert.equal(speakingBandFromCriteria(bands(6, 6, 6, 6)), 6.0);
// mean .25 -> rounds up to .5 (25/4 = 6.25)
assert.equal(speakingBandFromCriteria(bands(6, 6, 7, 6)), 6.5);
// mean .75 -> rounds up to next whole (27/4 = 6.75)
assert.equal(speakingBandFromCriteria(bands(6, 7, 7, 7)), 7.0);
// half-band criteria (25/4 = 6.25 -> 6.5)
assert.equal(speakingBandFromCriteria(bands(6.5, 6.5, 6, 6)), 6.5);
// 24.5/4 = 6.125 -> 6.0
assert.equal(speakingBandFromCriteria(bands(6, 6, 6, 6.5)), 6.0);
// extremes
assert.equal(speakingBandFromCriteria(bands(9, 9, 9, 9)), 9);
assert.equal(speakingBandFromCriteria(bands(0, 0, 0, 0)), 0);
// guards (each must throw — covers assertScorable branches)
assert.throws(
  () => speakingBandFromCriteria(bands(Number.NaN, 6, 6, 6)),
  /finite/,
);
assert.throws(() => speakingBandFromCriteria(bands(-1, 6, 6, 6)), /between/);
assert.throws(() => speakingBandFromCriteria(bands(6, 9.5, 6, 6)), /between/);

// --- attemptSpeakingBand ----------------------------------------------------
// nothing scored yet
assert.equal(attemptSpeakingBand([]), null);
// single part = that band
assert.equal(attemptSpeakingBand([6.5]), 6.5);
// mean across parts, half-band rounded: (6 + 7 + 7)/3 = 6.667 -> 6.5
assert.equal(attemptSpeakingBand([6, 7, 7]), 6.5);
// (6.5 + 7 + 7.5)/3 = 7.0
assert.equal(attemptSpeakingBand([6.5, 7, 7.5]), 7.0);
// equal parts
assert.equal(attemptSpeakingBand([7, 7, 7]), 7.0);
// .25 rounds up: (6 + 6 + 6.5)/3 = 6.1667 -> 6.0; (6.5 + 6.5 + 7)/3 = 6.667 -> 6.5
assert.equal(attemptSpeakingBand([6, 6, 6.5]), 6.0);
assert.equal(attemptSpeakingBand([6.5, 6.5, 7]), 6.5);
// extremes
assert.equal(attemptSpeakingBand([9, 9]), 9);
assert.equal(attemptSpeakingBand([0]), 0);
// guards on the response bands
assert.throws(() => attemptSpeakingBand([6, Number.NaN]), /finite/);
assert.throws(() => attemptSpeakingBand([6, 10]), /between/);
assert.throws(() => attemptSpeakingBand([-0.5]), /between/);

console.log("scoring/ielts-speaking/band-math tests passed");
