import assert from "node:assert/strict";
import { extractPronunciationSignal } from "./phoneme-contract";

// --- empty / unusable inputs -> null ----------------------------------------
assert.equal(extractPronunciationSignal(null), null);
assert.equal(extractPronunciationSignal(undefined), null);
assert.equal(extractPronunciationSignal({}), null); // the schema default
assert.equal(extractPronunciationSignal([1, 2, 3]), null); // array, not a report
assert.equal(extractPronunciationSignal("nope"), null);
// object with only non-numeric scores + no words -> null
assert.equal(
  extractPronunciationSignal({ pronunciationScore: "high", words: 5 }),
  null,
);

// --- full Azure-shaped report -----------------------------------------------
const full = extractPronunciationSignal({
  pronunciationScore: 78,
  accuracyScore: 82,
  fluencyScore: 75,
  completenessScore: 100,
  prosodyScore: 68,
  words: [
    { word: "hello", accuracyScore: 95, errorType: "None" },
    { word: "th-thing", accuracyScore: 40, errorType: "Mispronunciation" },
    { word: "quiet", accuracyScore: 55, errorType: "None" }, // low accuracy -> flagged
    { word: "the", accuracyScore: 90, errorType: "Omission" }, // error type -> flagged
    { word: "  ", accuracyScore: 10, errorType: "Mispronunciation" }, // blank -> skipped
    { notAWord: true },
  ],
});
assert.ok(full);
assert.equal(full?.pronunciationScore, 78);
assert.equal(full?.accuracyScore, 82);
assert.equal(full?.fluencyScore, 75);
assert.equal(full?.completenessScore, 100);
assert.equal(full?.prosodyScore, 68);
assert.deepEqual(full?.mispronouncedWords, ["th-thing", "quiet", "the"]);

// --- scores only (no words array) -> signal with empty flagged list ---------
const scoresOnly = extractPronunciationSignal({ pronunciationScore: 60 });
assert.ok(scoresOnly);
assert.equal(scoresOnly?.pronunciationScore, 60);
assert.equal(scoresOnly?.accuracyScore, null);
assert.deepEqual(scoresOnly?.mispronouncedWords, []);

// --- words only (no aggregate scores) -> signal -----------------------------
const wordsOnly = extractPronunciationSignal({
  words: [{ word: "specific", accuracyScore: 30, errorType: "Mispronunciation" }],
});
assert.ok(wordsOnly);
assert.equal(wordsOnly?.pronunciationScore, null);
assert.deepEqual(wordsOnly?.mispronouncedWords, ["specific"]);

// --- non-finite numeric scores are dropped ----------------------------------
const infScore = extractPronunciationSignal({
  pronunciationScore: Number.POSITIVE_INFINITY,
  words: [{ word: "ok", accuracyScore: 20, errorType: "Mispronunciation" }],
});
assert.equal(infScore?.pronunciationScore, null);
assert.deepEqual(infScore?.mispronouncedWords, ["ok"]);

// --- flagged-word cap (25) --------------------------------------------------
const many = extractPronunciationSignal({
  words: Array.from({ length: 40 }, (_, i) => ({
    word: `w${i}`,
    accuracyScore: 10,
    errorType: "Mispronunciation",
  })),
});
assert.equal(many?.mispronouncedWords.length, 25);

console.log("ielts/speaking-scorer/phoneme-contract tests passed");
