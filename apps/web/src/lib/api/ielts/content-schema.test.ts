/**
 * Unit tests for passage / listening-section / band-conversion schemas (WS-1.1).
 */
import assert from "node:assert/strict";
import { parseInput } from "@/lib/api/boundary";
import {
  CreateBandConversionSchema,
  CreateListeningSectionSchema,
  CreatePassageSchema,
  DeleteBandConversionTableSchema,
  ReplaceBandConversionTableSchema,
  groupBandConversionTables,
  toBandConversionInsert,
  toBandConversionRows,
  toListeningSectionInsert,
  toPassageInsert,
} from "./content-schema";

const TID = "11111111-1111-4111-8111-111111111111";

// passage round-trips to a typed insert
{
  const input = parseInput(CreatePassageSchema, {
    testId: TID,
    title: " The Return of the Wolf ",
    body: "Full passage…",
    wordCount: 850,
    genre: "Expository",
  });
  const row = toPassageInsert(input);
  assert.equal(row.test_id, TID);
  assert.equal(row.title, "The Return of the Wolf");
  assert.equal(row.word_count, 850);
  assert.equal(row.genre, "Expository");
}

// listening section: speakers + accent + section number
{
  const input = parseInput(CreateListeningSectionSchema, {
    testId: TID,
    sectionNumber: 1,
    script: "CALLER: Hello…",
    accent: "uk",
    speakers: [{ name: "caller", accent: "uk" }],
  });
  const row = toListeningSectionInsert(input);
  assert.equal(row.section_number, 1);
  assert.equal(row.accent, "uk");
  assert.deepEqual(row.speakers, [{ name: "caller", accent: "uk" }]);
}
// section number out of 1..4 is rejected
assert.throws(() =>
  parseInput(CreateListeningSectionSchema, { testId: TID, sectionNumber: 5, script: "x" }),
);

// band conversion: half-band enforcement + raw range
{
  const input = parseInput(CreateBandConversionSchema, {
    skill: "listening",
    band: 6.5,
    rawMin: 26,
    rawMax: 29,
  });
  const row = toBandConversionInsert(input);
  assert.equal(row.conversion_key, "default");
  assert.equal(row.band, 6.5);
  assert.equal(row.module, null);
}
assert.throws(
  () => parseInput(CreateBandConversionSchema, { skill: "reading", band: 6.3, rawMin: 1, rawMax: 2 }),
  "non-half band rejected",
);
assert.throws(
  () => parseInput(CreateBandConversionSchema, { skill: "reading", band: 6, rawMin: 10, rawMax: 2 }),
  "rawMax < rawMin rejected",
);

// --- Band-conversion TABLE (replace) --------------------------------------
// Reading table → typed insert rows.
{
  const input = parseInput(ReplaceBandConversionTableSchema, {
    conversionKey: "cam-19-test-1",
    skill: "reading",
    module: "academic",
    rows: [
      { band: 9, rawMin: 39, rawMax: 40 },
      { band: 8.5, rawMin: 37, rawMax: 38 },
    ],
  });
  const rows = toBandConversionRows(input);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[0], {
    conversion_key: "cam-19-test-1",
    skill: "reading",
    module: "academic",
    band: 9,
    raw_min: 39,
    raw_max: 40,
  });
}
// Listening table is module-independent (module omitted → null).
{
  const input = parseInput(ReplaceBandConversionTableSchema, {
    conversionKey: "default",
    skill: "listening",
    rows: [{ band: 9, rawMin: 39, rawMax: 40 }],
  });
  assert.equal(toBandConversionRows(input)[0].module, null);
}
// Reading without a module is rejected; listening WITH a module is rejected.
assert.throws(() =>
  parseInput(ReplaceBandConversionTableSchema, {
    conversionKey: "k",
    skill: "reading",
    rows: [{ band: 9, rawMin: 39, rawMax: 40 }],
  }),
);
assert.throws(() =>
  parseInput(ReplaceBandConversionTableSchema, {
    conversionKey: "k",
    skill: "listening",
    module: "academic",
    rows: [{ band: 9, rawMin: 39, rawMax: 40 }],
  }),
);
// Duplicate bands in one table are rejected.
assert.throws(() =>
  parseInput(ReplaceBandConversionTableSchema, {
    conversionKey: "k",
    skill: "listening",
    rows: [
      { band: 7, rawMin: 30, rawMax: 31 },
      { band: 7, rawMin: 28, rawMax: 29 },
    ],
  }),
);

// --- DeleteBandConversionTableSchema --------------------------------------
{
  const parsed = parseInput(DeleteBandConversionTableSchema, {
    conversionKey: "default",
    skill: "reading",
    module: "academic",
  });
  assert.equal(parsed.skill, "reading");
}

// --- groupBandConversionTables --------------------------------------------
{
  const grouped = groupBandConversionTables([
    { conversion_key: "default", skill: "listening", module: null, band: 7, raw_min: 30, raw_max: 31 },
    { conversion_key: "default", skill: "listening", module: null, band: 9, raw_min: 39, raw_max: 40 },
    { conversion_key: "default", skill: "reading", module: "academic", band: 6, raw_min: 23, raw_max: 26 },
  ]);
  assert.equal(grouped.length, 2);
  // Tables sorted; rows within a table sorted band-desc.
  const listening = grouped.find((g) => g.skill === "listening");
  assert.ok(listening);
  assert.deepEqual(listening.rows.map((r) => r.band), [9, 7]);
  assert.equal(listening.module, null);
  const reading = grouped.find((g) => g.skill === "reading");
  assert.equal(reading?.module, "academic");
}

console.log("IELTS content-schema tests passed");
