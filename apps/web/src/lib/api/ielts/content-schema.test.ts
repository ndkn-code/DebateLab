/**
 * Unit tests for passage / listening-section / band-conversion schemas (WS-1.1).
 */
import assert from "node:assert/strict";
import { parseInput } from "@/lib/api/boundary";
import {
  CreateBandConversionSchema,
  CreateListeningSectionSchema,
  CreatePassageSchema,
  toBandConversionInsert,
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

console.log("IELTS content-schema tests passed");
