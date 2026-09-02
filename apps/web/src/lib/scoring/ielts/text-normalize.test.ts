import assert from "node:assert/strict";
import {
  canonicalForMatch,
  countWords,
  exceedsWordLimit,
  normalizeText,
  numberWordsToDigits,
  numericValue,
  parseAllowNumber,
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
// allowNumber ("… AND/OR A NUMBER"): numeric tokens are free
assert.equal(countWords("3 weeks", { allowNumber: true }), 1);
assert.equal(countWords("3 weeks"), 2);
assert.equal(countWords("3 weeks", { allowNumber: false }), 2);
assert.equal(countWords("$50", { allowNumber: true }), 0);
assert.equal(countWords("10,000 people", { allowNumber: true }), 1);
assert.equal(countWords("well-being 2", { allowNumber: true }), 1); // hyphenated still one word

// ── exceedsWordLimit ─────────────────────────────────────────────────────────
assert.equal(exceedsWordLimit("any number of words here", null), false); // no limit
assert.equal(exceedsWordLimit("two words", 2), false); // exactly at limit
assert.equal(exceedsWordLimit("three little words", 2), true); // over
assert.equal(exceedsWordLimit("", 2), false);
assert.equal(exceedsWordLimit("3 weeks", 1), true); // 2 words without the allowance
assert.equal(exceedsWordLimit("3 weeks", 1, { allowNumber: true }), false); // number is free
assert.equal(exceedsWordLimit("3 long weeks", 1, { allowNumber: true }), true); // still 2 words

// ── parseAllowNumber ─────────────────────────────────────────────────────────
assert.equal(parseAllowNumber("Write ONE WORD AND/OR A NUMBER for each answer."), true);
assert.equal(parseAllowNumber("NO MORE THAN TWO WORDS AND / OR A NUMBER"), true);
assert.equal(parseAllowNumber("NO MORE THAN THREE WORDS AND A NUMBER"), true);
assert.equal(parseAllowNumber("ONE WORD OR A NUMBER"), true);
assert.equal(parseAllowNumber("Write NO MORE THAN TWO WORDS for each answer."), false);
assert.equal(parseAllowNumber("Choose the correct letter, A, B or C."), false);
assert.equal(parseAllowNumber(null), false);
assert.equal(parseAllowNumber(undefined), false);
assert.equal(parseAllowNumber(""), false);

// ── numberWordsToDigits ──────────────────────────────────────────────────────
assert.equal(numberWordsToDigits("twenty"), "20");
assert.equal(numberWordsToDigits("twenty one"), "21");
assert.equal(numberWordsToDigits("two hundred"), "200");
assert.equal(numberWordsToDigits("two hundred and fifty"), "250");
assert.equal(numberWordsToDigits("three thousand"), "3000");
assert.equal(numberWordsToDigits("one million"), "1000000");
assert.equal(numberWordsToDigits("twelve thousand five hundred"), "12500");
assert.equal(numberWordsToDigits("zero"), "0");
assert.equal(numberWordsToDigits("first floor"), "1st floor");
assert.equal(numberWordsToDigits("tenth"), "10th");
assert.equal(numberWordsToDigits("five weeks"), "5 weeks");
assert.equal(numberWordsToDigits("one two"), "one two"); // malformed run left alone
assert.equal(numberWordsToDigits("twenty ten"), "twenty ten");
assert.equal(numberWordsToDigits("bread and butter"), "bread and butter"); // "and" outside a number
assert.equal(numberWordsToDigits("garden"), "garden");

// ── canonicalForMatch ────────────────────────────────────────────────────────
assert.equal(canonicalForMatch("Twenty"), "20");
assert.equal(canonicalForMatch("twenty-one"), "21");
assert.equal(canonicalForMatch("Part-Time"), "part time");
assert.equal(canonicalForMatch("the garden"), "garden");
assert.equal(canonicalForMatch("The Garden"), "garden");
assert.equal(canonicalForMatch("an apple"), "apple");
assert.equal(canonicalForMatch("a"), "a"); // article-only stays
assert.equal(canonicalForMatch("the"), "the");
assert.equal(canonicalForMatch("the the garden"), "the garden"); // only ONE article stripped
assert.equal(canonicalForMatch("-7"), "-7"); // sign is not a hyphen

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
assert.equal(textMatches("two", ["2"]), true); // number words ≡ digits (official marking)
assert.equal(textMatches("twenty", ["20"]), true);
assert.equal(textMatches("20", ["twenty"]), true); // symmetric
assert.equal(textMatches("twenty-one", ["21"]), true);
assert.equal(textMatches("Twenty One", ["21"]), true);
assert.equal(textMatches("twenty", ["20.0"]), true); // words → numeric fallback
assert.equal(textMatches("part-time", ["part time"]), true);
assert.equal(textMatches("part time", ["part-time"]), true);
assert.equal(textMatches("the garden", ["garden"]), true);
assert.equal(textMatches("garden", ["the garden"]), true);
assert.equal(textMatches("a", [""]), false); // article-only never matches empty
assert.equal(textMatches("a", ["a"]), true);
assert.equal(textMatches("first floor", ["1st floor"]), true);
assert.equal(textMatches("twenty two", ["twenty three"]), false);

console.log("scoring/ielts/text-normalize tests passed");
