import assert from "node:assert/strict";
import {
  WRITING_CRITERIA,
  snapToHalfBand,
  taskBandFromCriteria,
  writingOverallBand,
  type WritingCriteriaBands,
} from "./band-math";

function bands(
  taskResponse: number,
  coherenceCohesion: number,
  lexicalResource: number,
  grammaticalRangeAccuracy: number,
): WritingCriteriaBands {
  return {
    taskResponse,
    coherenceCohesion,
    lexicalResource,
    grammaticalRangeAccuracy,
  };
}

// --- WRITING_CRITERIA -------------------------------------------------------
assert.deepEqual(WRITING_CRITERIA, [
  "taskResponse",
  "coherenceCohesion",
  "lexicalResource",
  "grammaticalRangeAccuracy",
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
// clamping out-of-range model output
assert.equal(snapToHalfBand(-3), 0);
assert.equal(snapToHalfBand(12.4), 9);
// guard
assert.throws(() => snapToHalfBand(Number.NaN), /finite/);
assert.throws(() => snapToHalfBand(Number.POSITIVE_INFINITY), /finite/);

// --- taskBandFromCriteria ---------------------------------------------------
// mean exactly on a half-band
assert.equal(taskBandFromCriteria(bands(6, 7, 6, 7)), 6.5); // 26/4 = 6.5
// mean .25 -> rounds up to .5
assert.equal(taskBandFromCriteria(bands(6, 6, 7, 6)), 6.5); // 25/4 = 6.25
// mean .75 -> rounds up to next whole
assert.equal(taskBandFromCriteria(bands(6, 7, 7, 7)), 7.0); // 27/4 = 6.75
// half-band criteria
assert.equal(taskBandFromCriteria(bands(6.5, 6.5, 6, 6)), 6.5); // 25/4 = 6.25 -> 6.5
assert.equal(taskBandFromCriteria(bands(6, 6, 6, 6.5)), 6.0); // 24.5/4 = 6.125 -> 6.0
// extremes
assert.equal(taskBandFromCriteria(bands(9, 9, 9, 9)), 9);
assert.equal(taskBandFromCriteria(bands(0, 0, 0, 0)), 0);
// guards (each must throw — covers assertScorable branches)
assert.throws(() => taskBandFromCriteria(bands(Number.NaN, 6, 6, 6)), /finite/);
assert.throws(() => taskBandFromCriteria(bands(-1, 6, 6, 6)), /between/);
assert.throws(() => taskBandFromCriteria(bands(6, 9.5, 6, 6)), /between/);

// --- writingOverallBand -----------------------------------------------------
// neither task
assert.equal(writingOverallBand({}), null);
assert.equal(writingOverallBand({ task1Band: null, task2Band: null }), null);
// single task = that band
assert.equal(writingOverallBand({ task1Band: 6.5 }), 6.5);
assert.equal(writingOverallBand({ task2Band: 7 }), 7.0);
// both: Task 2 double-weighted, then half-band rounded
// canonical example: T1 6, T2 7 -> (6 + 7 + 7)/3 = 6.667 -> 6.5
assert.equal(writingOverallBand({ task1Band: 6, task2Band: 7 }), 6.5);
// T1 7, T2 6 -> (7 + 6 + 6)/3 = 6.333 -> 6.5
assert.equal(writingOverallBand({ task1Band: 7, task2Band: 6 }), 6.5);
// T1 6.5, T2 7 -> (6.5 + 14)/3 = 6.833 -> 7.0
assert.equal(writingOverallBand({ task1Band: 6.5, task2Band: 7 }), 7.0);
// equal tasks
assert.equal(writingOverallBand({ task1Band: 7, task2Band: 7 }), 7.0);
// low end
assert.equal(writingOverallBand({ task1Band: 5, task2Band: 5.5 }), 5.5);
// guards on present branches
assert.throws(() => writingOverallBand({ task1Band: 10 }), /between/);
assert.throws(() => writingOverallBand({ task2Band: -1 }), /between/);
assert.throws(
  () => writingOverallBand({ task1Band: 6, task2Band: 9.5 }),
  /between/,
);

console.log("scoring/ielts-writing/band-math tests passed");
