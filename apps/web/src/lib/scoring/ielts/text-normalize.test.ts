import assert from "node:assert/strict";
import {
  countWords,
  exceedsWordLimit,
  normalizeText,
  numericValue,
  textMatches,
} from "./text-normalize";

// ── normalizeText ────────────────────────────────────────────────────────────
assert.equal(normalizeText("  Photosynthesis  "), "photosynthesis");
assert.equal(normalizeText("Carbon Dioxide"), "carbon dioxide");
assert.equal(normalizeText("the   answer\tis\nhere"), "the answer is here");
assert.equal(normalizeText("“quoted”"), "quoted"); // smart quotes stripped as edge punct
assert.equal(normalizeText("can’t"), "can't"); // curly apostrophe normalized
assert.equal(normalizeText("well‑being"), "well-being"); // non-breaking hyphen → "-"
assert.equal(normalizeText("Photosynthesis."), "photosynthesis"); // trailing period
assert.equal(normalizeText("!?word;:"), "word"); // edge punctuation both sides
assert.equal(normalizeText("20%"), "20%"); // internal/standalone symbols kept
assert.equal(normalizeText(""), "");

// ── countWords ───────────────────────────────────────────────────────────────
assert.equal(countWords(""), 0);
assert.equal(countWords("   "), 0);
assert.equal(countWords("moon"), 1);
assert.equal(countWords("the full moon"), 3);
assert.equal(countWords("well-being"), 1); // hyphenated = one word
assert.equal(countWords("10,000"), 1);

// ── exceedsWordLimit ─────────────────────────────────────────────────────────
assert.equal(exceedsWordLimit("any number of words here", null), false); // no limit
assert.equal(exceedsWordLimit("two words", 2), false); // exactly at limit
assert.equal(exceedsWordLimit("three little words", 2), true); // over
assert.equal(exceedsWordLimit("", 2), false);

// ── numericValue ─────────────────────────────────────────────────────────────
assert.equal(numericValue("42"), 42);
assert.equal(numericValue("3.0"), 3);
assert.equal(numericValue(".5"), 0.5);
assert.equal(numericValue("-7"), -7);
assert.equal(numericValue("1,000"), 1000);
assert.equal(numericValue("$50"), 50);
assert.equal(numericValue("20%"), 20);
assert.equal(numericValue("twelve"), null);
assert.equal(numericValue(""), null);
assert.equal(numericValue("9".repeat(400)), null); // overflows to Infinity → rejected

// ── textMatches ──────────────────────────────────────────────────────────────
assert.equal(textMatches("Photosynthesis", ["photosynthesis"]), true); // case
assert.equal(textMatches("  the moon ", ["the moon"]), true); // whitespace
assert.equal(textMatches("colour", ["color", "colour"]), true); // variant list
assert.equal(textMatches("3", ["3.0"]), true); // numeric equality
assert.equal(textMatches("1000", ["1,000"]), true); // numeric, separators
assert.equal(textMatches("5", ["6"]), false); // numeric, no match
assert.equal(textMatches("cat", ["dog"]), false); // text, no match
assert.equal(textMatches("", ["anything"]), false); // empty answer
assert.equal(textMatches("two", ["2"]), false); // word ≠ numeral unless authored

console.log("scoring/ielts/text-normalize tests passed");
