import assert from "node:assert/strict";
import { parsePhonemeReport } from "@/lib/scoring/ielts-pronunciation/phoneme-report";
import { extractPronunciationSignal } from "./phoneme-contract";

// --- empty / unusable inputs -> null (parsePhonemeReport falls back to EMPTY) ---
assert.equal(extractPronunciationSignal(null), null);
assert.equal(extractPronunciationSignal(undefined), null);
assert.equal(extractPronunciationSignal({}), null); // the bare jsonb default (status "empty")
assert.equal(extractPronunciationSignal([1, 2, 3]), null); // array, not a report
assert.equal(extractPronunciationSignal("nope"), null);
// The legacy FLAT shape no longer validates as a scored report -> null.
assert.equal(
  extractPronunciationSignal({ pronunciationScore: 78, accuracyScore: 82 }),
  null,
);
// status "scored" but overall null -> no usable aggregate -> null.
assert.equal(
  extractPronunciationSignal({ status: "scored", overall: null, words: [] }),
  null,
);

// --- full Azure-shaped (WS-3.3 canonical) report ----------------------------
const full = extractPronunciationSignal({
  status: "scored",
  overall: {
    pronunciation: 78,
    accuracy: 82,
    fluency: 75,
    completeness: 100,
    prosody: 68,
  },
  words: [
    { word: "hello", accuracy: 95, errorType: "None", phonemes: [] },
    { word: "th-thing", accuracy: 40, errorType: "Mispronunciation", phonemes: [] },
    { word: "quiet", accuracy: 55, errorType: "None", phonemes: [] }, // low accuracy -> flagged
    { word: "the", accuracy: 90, errorType: "Omission", phonemes: [] }, // error type -> flagged
    { word: "  ", accuracy: 10, errorType: "Mispronunciation", phonemes: [] }, // blank -> skipped
  ],
});
assert.ok(full);
assert.equal(full?.pronunciationScore, 78);
assert.equal(full?.accuracyScore, 82);
assert.equal(full?.fluencyScore, 75);
assert.equal(full?.completenessScore, 100);
assert.equal(full?.prosodyScore, 68);
assert.deepEqual(full?.mispronouncedWords, ["th-thing", "quiet", "the"]);

// --- prosody may be null ----------------------------------------------------
const noProsody = extractPronunciationSignal({
  status: "scored",
  overall: { pronunciation: 60, accuracy: 60, fluency: 60, completeness: 60, prosody: null },
  words: [],
});
assert.ok(noProsody);
assert.equal(noProsody?.prosodyScore, null);
assert.deepEqual(noProsody?.mispronouncedWords, []);

// --- flagged-word cap (25) --------------------------------------------------
const many = extractPronunciationSignal({
  status: "scored",
  overall: { pronunciation: 50, accuracy: 50, fluency: 50, completeness: 50, prosody: null },
  words: Array.from({ length: 40 }, (_, i) => ({
    word: `w${i}`,
    accuracy: 10,
    errorType: "Mispronunciation",
    phonemes: [],
  })),
});
assert.equal(many?.mispronouncedWords.length, 25);

// --- an already-parsed PhonemeReport passes through (idempotent) ------------
const parsed = parsePhonemeReport({
  status: "scored",
  overall: { pronunciation: 70, accuracy: 70, fluency: 70, completeness: 70, prosody: 70 },
  words: [],
});
assert.equal(extractPronunciationSignal(parsed)?.pronunciationScore, 70);

console.log("ielts/speaking-scorer/phoneme-contract tests passed");
