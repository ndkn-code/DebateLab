import assert from "node:assert/strict";
import {
  EMPTY_PHONEME_REPORT,
  PRONUNCIATION_ERROR_TYPES,
  isScoredPhonemeReport,
  parsePhonemeReport,
  phonemeReportSchema,
} from "./phoneme-report";

// --- error-type constant ----------------------------------------------------
assert.deepEqual(PRONUNCIATION_ERROR_TYPES, [
  "None",
  "Mispronunciation",
  "Omission",
  "Insertion",
  "UnexpectedBreak",
  "MissingBreak",
  "Monotone",
]);

// --- the bare jsonb `{}` default parses to an EMPTY report -------------------
const fromEmptyObject = phonemeReportSchema.parse({});
assert.equal(fromEmptyObject.schemaVersion, 1);
assert.equal(fromEmptyObject.status, "empty");
assert.equal(fromEmptyObject.overall, null);
assert.deepEqual(fromEmptyObject.words, []);
assert.deepEqual(EMPTY_PHONEME_REPORT, fromEmptyObject);

// --- a full scored object validates -----------------------------------------
const scored = {
  schemaVersion: 1 as const,
  status: "scored" as const,
  provider: "azure",
  model: "pronunciation-assessment",
  locale: "en-US",
  referenceText: "a good answer",
  recognizedText: "a good answer",
  overall: {
    accuracy: 88,
    fluency: 90,
    completeness: 100,
    prosody: 85,
    pronunciation: 89,
  },
  words: [
    {
      word: "good",
      accuracy: 92,
      errorType: "None",
      phonemes: [
        { phoneme: "ɡ", accuracy: 95 },
        { phoneme: "ʊ", accuracy: 90 },
        { phoneme: "d", accuracy: 91 },
      ],
    },
  ],
};
const parsedScored = phonemeReportSchema.parse(scored);
assert.equal(parsedScored.status, "scored");
assert.equal(parsedScored.overall?.pronunciation, 89);
assert.equal(parsedScored.words[0]?.phonemes.length, 3);

// prosody may be null
const nullProsody = phonemeReportSchema.parse({
  ...scored,
  overall: { ...scored.overall, prosody: null },
});
assert.equal(nullProsody.overall?.prosody, null);

// --- invalid: score out of 0–100 range --------------------------------------
assert.equal(
  phonemeReportSchema.safeParse({
    ...scored,
    overall: { ...scored.overall, accuracy: 150 },
  }).success,
  false,
);

// --- parsePhonemeReport: valid → parsed, anything else → EMPTY ---------------
assert.equal(parsePhonemeReport(scored).status, "scored");
assert.equal(parsePhonemeReport({}).status, "empty");
assert.deepEqual(parsePhonemeReport(null), EMPTY_PHONEME_REPORT);
assert.deepEqual(parsePhonemeReport("nope"), EMPTY_PHONEME_REPORT);
assert.deepEqual(
  parsePhonemeReport({ overall: { accuracy: "bad" } }),
  EMPTY_PHONEME_REPORT,
);

// --- isScoredPhonemeReport: needs status "scored" AND overall present --------
assert.equal(isScoredPhonemeReport(EMPTY_PHONEME_REPORT), false);
assert.equal(isScoredPhonemeReport(parsedScored), true);
const scoredButNoOverall = phonemeReportSchema.parse({
  ...scored,
  overall: null,
});
assert.equal(isScoredPhonemeReport(scoredButNoOverall), false);

console.log("scoring/ielts-pronunciation/phoneme-report tests passed");
