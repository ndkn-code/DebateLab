/**
 * Unit tests for the pure normalization helpers (WS-1.1). Run under tsx.
 */
import assert from "node:assert/strict";
import {
  dedupeStrings,
  normalizeAnswerKey,
  normalizeTfngToken,
  normalizeWhitespace,
  normalizeYnngToken,
  parseLeadingInt,
  splitPipeList,
} from "./normalize";

// normalizeWhitespace
assert.equal(normalizeWhitespace("  a   b\tc  "), "a b c");

// splitPipeList tolerates spacing, empties, trailing pipe
assert.deepEqual(splitPipeList("a | b ||c |"), ["a", "b", "c"]);
assert.deepEqual(splitPipeList(""), []);
assert.deepEqual(splitPipeList(null), []);

// dedupeStrings is case-insensitive, order-preserving
assert.deepEqual(dedupeStrings(["Trophic", "trophic", " cascade "]), ["Trophic", "cascade"]);

// parseLeadingInt pulls the first integer from loose cells
assert.equal(parseLeadingInt("≈850"), 850);
assert.equal(parseLeadingInt("150 words"), 150);
assert.equal(parseLeadingInt("40 min"), 40);
assert.equal(parseLeadingInt("none"), null);
assert.equal(parseLeadingInt(null), null);

// TF/NG + YN/NG canonicalization
for (const [raw, want] of [
  ["f", "FALSE"],
  ["FALSE", "FALSE"],
  ["t", "TRUE"],
  ["ng", "NOT GIVEN"],
  ["not given", "NOT GIVEN"],
  ["notgiven", "NOT GIVEN"],
] as const) {
  assert.equal(normalizeTfngToken(raw), want, `tfng ${raw}`);
}
assert.equal(normalizeTfngToken("maybe"), null);

for (const [raw, want] of [
  ["y", "YES"],
  ["no", "NO"],
  ["NG", "NOT GIVEN"],
] as const) {
  assert.equal(normalizeYnngToken(raw), want, `ynng ${raw}`);
}

// normalizeAnswerKey strips surrounding punctuation + lowercases
assert.equal(normalizeAnswerKey("  Trophic Cascade. "), "trophic cascade");
assert.equal(normalizeAnswerKey("(2003)"), "2003");

console.log("IELTS normalize tests passed");
