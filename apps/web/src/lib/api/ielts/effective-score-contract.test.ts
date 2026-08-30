import assert from "node:assert/strict";
import test from "node:test";
import { projectEffectiveBands } from "./effective-score-contract";

test("teacher-aware effective score wins over the AI score", () => {
  const result = projectEffectiveBands(
    {
      listening_band: 7,
      reading_band: 7.5,
      writing_band: 8,
      speaking_band: 7,
      overall_band: 7.5,
      provisional_band: 7.5,
      overall_is_provisional: false,
      score_source: "mixed",
    },
    { writing_band: 6.5, overall_band: 7 },
  );
  assert.equal(result.writingBand, 8);
  assert.equal(result.overallBand, 7.5);
  assert.equal(result.scoreSource, "mixed");
});

test("a partial average is never exposed as an official overall band", () => {
  const result = projectEffectiveBands(null, {
    listening_band: 7,
    reading_band: 7,
    writing_band: null,
    speaking_band: null,
    overall_band: 7,
  });
  assert.equal(result.overallBand, null);
  assert.equal(result.provisionalBand, 7);
  assert.equal(result.overallIsProvisional, true);
});
