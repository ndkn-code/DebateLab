import assert from "node:assert/strict";
import {
  computeObjectiveBands,
  rawToBand,
  type BandConversionRow,
} from "./band-conversion";

const row = (
  conversion_key: string,
  skill: BandConversionRow["skill"],
  module: BandConversionRow["module"],
  band: number,
  raw_min: number,
  raw_max: number,
): BandConversionRow => ({ conversion_key, skill, module, band, raw_min, raw_max });

// Representative subset of the seeded `default` table.
const rows: BandConversionRow[] = [
  row("default", "listening", null, 9.0, 39, 40),
  row("default", "listening", null, 7.0, 30, 31),
  row("default", "listening", null, 5.0, 16, 17),
  row("default", "reading", "academic", 7.0, 30, 32),
  row("default", "reading", "academic", 5.0, 15, 18),
  row("default", "reading", "general_training", 7.0, 34, 35),
  row("default", "reading", "general_training", 5.0, 23, 26),
];

// ---- rawToBand: basic lookups ----------------------------------------------
assert.equal(rawToBand(rows, "listening", null, 40), 9.0);
assert.equal(rawToBand(rows, "listening", null, 30), 7.0);
assert.equal(rawToBand(rows, "listening", null, 16), 5.0);
assert.equal(rawToBand(rows, "listening", null, 25), null); // gap in subset -> unscored

// Reading splits Academic vs General Training at the same raw count.
assert.equal(rawToBand(rows, "reading", "academic", 31), 7.0);
assert.equal(rawToBand(rows, "reading", "general_training", 31), null); // 31 not a GT band here
assert.equal(rawToBand(rows, "reading", "general_training", 35), 7.0);
assert.equal(rawToBand(rows, "reading", "academic", 16), 5.0);
assert.equal(rawToBand(rows, "reading", "general_training", 24), 5.0);

// ---- specificity: a test-specific key beats `default` ----------------------
const withTestKey: BandConversionRow[] = [
  ...rows,
  row("cam-19-test-1", "reading", "academic", 8.0, 30, 32), // same raw band, higher band
];
assert.equal(rawToBand(withTestKey, "reading", "academic", 31), 8.0); // prefers test key

// module-specific beats module-agnostic when both cover the raw
const mixedModule: BandConversionRow[] = [
  row("default", "reading", null, 6.0, 30, 32), // agnostic
  row("default", "reading", "academic", 7.0, 30, 32), // specific
];
assert.equal(rawToBand(mixedModule, "reading", "academic", 31), 7.0);

// ---- computeObjectiveBands -------------------------------------------------
// Both skills present -> provisional overall = half-band-rounded mean.
assert.deepEqual(
  computeObjectiveBands(rows, "academic", { listening: 30, reading: 31 }),
  { listeningBand: 7.0, readingBand: 7.0, overallBand: 7.0 },
);
// Mean 6.0 & 7.0 -> 6.5.
assert.deepEqual(
  computeObjectiveBands(rows, "academic", { listening: 16, reading: 31 }),
  { listeningBand: 5.0, readingBand: 7.0, overallBand: 6.0 },
);
// Only one skill sat.
assert.deepEqual(
  computeObjectiveBands(rows, "academic", { listening: 40, reading: null }),
  { listeningBand: 9.0, readingBand: null, overallBand: 9.0 },
);
assert.deepEqual(
  computeObjectiveBands(rows, "general_training", { listening: null, reading: 35 }),
  { listeningBand: null, readingBand: 7.0, overallBand: 7.0 },
);
// Neither -> all null.
assert.deepEqual(
  computeObjectiveBands(rows, "academic", { listening: null, reading: null }),
  { listeningBand: null, readingBand: null, overallBand: null },
);
// Raw with no covering row -> band null, overall null.
assert.deepEqual(
  computeObjectiveBands(rows, "academic", { listening: 25, reading: null }),
  { listeningBand: null, readingBand: null, overallBand: null },
);

console.log("scoring/ielts/band-conversion tests passed");
