import assert from "node:assert/strict";
import { derivePronunciationBand } from "./pronunciation-band";
import { EMPTY_PHONEME_REPORT, phonemeReportSchema } from "./phoneme-report";

/** Build a scored report whose composite PronScore is `pronunciation`. */
function scoredWith(pronunciation: number) {
  return phonemeReportSchema.parse({
    schemaVersion: 1,
    status: "scored",
    provider: "azure",
    model: "pronunciation-assessment",
    locale: "en-US",
    referenceText: "x",
    recognizedText: "x",
    overall: {
      accuracy: pronunciation,
      fluency: pronunciation,
      completeness: 100,
      prosody: null,
      pronunciation,
    },
    words: [],
  });
}

// --- empty / unscored → null ------------------------------------------------
assert.equal(derivePronunciationBand(EMPTY_PHONEME_REPORT), null);

// status "scored" but overall null → null (covers the overall-null branch)
const scoredNoOverall = phonemeReportSchema.parse({
  status: "scored",
  overall: null,
});
assert.equal(derivePronunciationBand(scoredNoOverall), null);

// --- linear 0–100 → 0–9, snapped to half-band -------------------------------
assert.equal(derivePronunciationBand(scoredWith(100)), 9); // 9.0
assert.equal(derivePronunciationBand(scoredWith(0)), 0); // 0.0
assert.equal(derivePronunciationBand(scoredWith(50)), 4.5); // 4.5
assert.equal(derivePronunciationBand(scoredWith(78)), 7); // 7.02 → 7.0
assert.equal(derivePronunciationBand(scoredWith(83)), 7.5); // 7.47 → 7.5
assert.equal(derivePronunciationBand(scoredWith(72)), 6.5); // 6.48 → 6.5
assert.equal(derivePronunciationBand(scoredWith(89)), 8); // 8.01 → 8.0

console.log("scoring/ielts-pronunciation/pronunciation-band tests passed");
