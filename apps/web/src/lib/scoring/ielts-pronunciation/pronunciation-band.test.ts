import assert from "node:assert/strict";
import {
  derivePronunciationBand,
  type PronunciationCalibrationProfile,
} from "./pronunciation-band";
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
    words: [
      {
        word: "example",
        accuracy: pronunciation,
        errorType: "None",
        phonemes: [],
      },
    ],
  });
}

const PROFILE: PronunciationCalibrationProfile = {
  version: "examiner-holdout-v1",
  provider: "azure",
  model: "pronunciation-assessment",
  locales: ["en-US"],
  minimumWordCount: 1,
  requiresProsody: false,
  knots: [
    { providerScore: 0, ieltsBand: 0 },
    { providerScore: 50, ieltsBand: 4.5 },
    { providerScore: 75, ieltsBand: 6.5 },
    { providerScore: 90, ieltsBand: 8 },
    { providerScore: 100, ieltsBand: 9 },
  ],
};

// --- empty / unscored → null ------------------------------------------------
assert.equal(derivePronunciationBand(EMPTY_PHONEME_REPORT), null);

// status "scored" but overall null → null (covers the overall-null branch)
const scoredNoOverall = phonemeReportSchema.parse({
  status: "scored",
  overall: null,
});
assert.equal(derivePronunciationBand(scoredNoOverall), null);

// No examiner-labelled profile means no direct Azure→IELTS claim.
assert.equal(derivePronunciationBand(scoredWith(89)), null);

// A matching, monotone, versioned profile enables bounded interpolation.
assert.equal(derivePronunciationBand(scoredWith(100), PROFILE), 9);
assert.equal(derivePronunciationBand(scoredWith(50), PROFILE), 4.5);
assert.equal(derivePronunciationBand(scoredWith(75), PROFILE), 6.5);
assert.equal(derivePronunciationBand(scoredWith(89), PROFILE), 8);
assert.equal(
  derivePronunciationBand(scoredWith(89), { ...PROFILE, model: "other" }),
  null,
);

console.log("scoring/ielts-pronunciation/pronunciation-band tests passed");
