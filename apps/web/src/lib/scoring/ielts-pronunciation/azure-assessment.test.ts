import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  azurePronunciationResponseSchema,
  mapAzureAssessmentToReport,
} from "./azure-assessment";
import { EMPTY_PHONEME_REPORT } from "./phoneme-report";

const OPTIONS = {
  locale: "en-US",
  provider: "azure",
  model: "pronunciation-assessment",
  referenceText: "a good answer",
};

function azureResponse(overrides: Record<string, unknown> = {}) {
  return {
    RecognitionStatus: "Success",
    DisplayText: "a good answer",
    NBest: [
      {
        Display: "a good answer",
        Lexical: "a good answer",
        PronunciationAssessment: {
          AccuracyScore: 88.6,
          FluencyScore: 90,
          CompletenessScore: 100,
          PronScore: 89,
          ProsodyScore: 85,
        },
        Words: [
          {
            Word: "good",
            PronunciationAssessment: { AccuracyScore: 92, ErrorType: "None" },
            Phonemes: [
              { Phoneme: "ɡ", PronunciationAssessment: { AccuracyScore: 95 } },
              { Phoneme: "ʊ", PronunciationAssessment: { AccuracyScore: 90 } },
            ],
          },
        ],
      },
    ],
    ...overrides,
  };
}

// --- full happy path: maps + rounds + clamps --------------------------------
const report = mapAzureAssessmentToReport(azureResponse(), OPTIONS);
assert.equal(report.status, "scored");
assert.equal(report.provider, "azure");
assert.equal(report.locale, "en-US");
assert.equal(report.referenceText, "a good answer");
assert.equal(report.recognizedText, "a good answer");
assert.equal(report.overall?.accuracy, 89); // 88.6 rounds to 89
assert.equal(report.overall?.fluency, 90);
assert.equal(report.overall?.completeness, 100);
assert.equal(report.overall?.prosody, 85);
assert.equal(report.overall?.pronunciation, 89);
assert.equal(report.words.length, 1);
assert.equal(report.words[0]?.word, "good");
assert.equal(report.words[0]?.errorType, "None");
assert.equal(report.words[0]?.phonemes[0]?.phoneme, "ɡ");
assert.equal(report.words[0]?.phonemes[0]?.accuracy, 95);

// --- clamping (out-of-range) + missing-field handling -----------------------
const clamped = mapAzureAssessmentToReport(
  azureResponse({
    NBest: [
      {
        Display: "x",
        PronunciationAssessment: {
          AccuracyScore: 88,
          PronScore: 90,
          CompletenessScore: 100,
          // FluencyScore omitted → undefined → 0
          // ProsodyScore omitted → undefined → null
        },
        Words: [
          {
            Word: "loud",
            PronunciationAssessment: { AccuracyScore: 150 }, // > 100 → 100
            Phonemes: [
              { Phoneme: "l", PronunciationAssessment: { AccuracyScore: -5 } }, // < 0 → 0
              { Phoneme: "d" }, // no PronunciationAssessment → 0
            ],
          },
          { Word: "bare" }, // no PronunciationAssessment / Phonemes → 0 / None / []
        ],
      },
    ],
  }),
  OPTIONS,
);
assert.equal(clamped.overall?.fluency, 0); // missing → 0
assert.equal(clamped.overall?.prosody, null); // missing → null
assert.equal(clamped.words[0]?.accuracy, 100); // 150 clamped
assert.equal(clamped.words[0]?.phonemes[0]?.accuracy, 0); // -5 clamped
assert.equal(clamped.words[0]?.phonemes[1]?.accuracy, 0); // missing → 0
assert.equal(clamped.words[1]?.accuracy, 0);
assert.equal(clamped.words[1]?.errorType, "None");
assert.deepEqual(clamped.words[1]?.phonemes, []);

// PronScore present but AccuracyScore missing still counts as usable overall
const pronScoreOnly = mapAzureAssessmentToReport(
  {
    RecognitionStatus: "Success",
    NBest: [{ Display: "x", PronunciationAssessment: { PronScore: 75 } }],
  },
  OPTIONS,
);
assert.equal(pronScoreOnly.status, "scored");
assert.equal(pronScoreOnly.overall?.pronunciation, 75);
assert.equal(pronScoreOnly.overall?.accuracy, 0); // missing accuracy → 0

// --- recognizedText falls back: Display → DisplayText → "" ------------------
const noDisplay = mapAzureAssessmentToReport(
  azureResponse({
    DisplayText: "from display text",
    NBest: [
      { PronunciationAssessment: { AccuracyScore: 80, PronScore: 80 }, Words: [] },
    ],
  }),
  OPTIONS,
);
assert.equal(noDisplay.recognizedText, "from display text");

const noTextAtAll = mapAzureAssessmentToReport(
  {
    RecognitionStatus: "Success",
    NBest: [{ PronunciationAssessment: { AccuracyScore: 80, PronScore: 80 } }],
  },
  OPTIONS,
);
assert.equal(noTextAtAll.recognizedText, "");
assert.deepEqual(noTextAtAll.words, []);

// --- no-op cases all return the EMPTY report --------------------------------
// non-Success recognition
assert.deepEqual(
  mapAzureAssessmentToReport(
    azureResponse({ RecognitionStatus: "NoMatch" }),
    OPTIONS,
  ),
  EMPTY_PHONEME_REPORT,
);
// no NBest
assert.deepEqual(
  mapAzureAssessmentToReport({ RecognitionStatus: "Success" }, OPTIONS),
  EMPTY_PHONEME_REPORT,
);
// NBest without PronunciationAssessment
assert.deepEqual(
  mapAzureAssessmentToReport(
    { RecognitionStatus: "Success", NBest: [{ Display: "x" }] },
    OPTIONS,
  ),
  EMPTY_PHONEME_REPORT,
);
// scores object present but no usable overall (only fluency)
assert.deepEqual(
  mapAzureAssessmentToReport(
    {
      RecognitionStatus: "Success",
      NBest: [{ PronunciationAssessment: { FluencyScore: 70 } }],
    },
    OPTIONS,
  ),
  EMPTY_PHONEME_REPORT,
);
// malformed payloads (schema parse fails)
assert.deepEqual(mapAzureAssessmentToReport(null, OPTIONS), EMPTY_PHONEME_REPORT);
assert.deepEqual(mapAzureAssessmentToReport("nope", OPTIONS), EMPTY_PHONEME_REPORT);
assert.deepEqual(mapAzureAssessmentToReport(42, OPTIONS), EMPTY_PHONEME_REPORT);

// status omitted entirely is treated as success when overall scores exist
const noStatus = mapAzureAssessmentToReport(
  { NBest: [{ PronunciationAssessment: { AccuracyScore: 70, PronScore: 72 } }] },
  OPTIONS,
);
assert.equal(noStatus.status, "scored");

// --- exported schema parses a sample ----------------------------------------
assert.equal(azurePronunciationResponseSchema.safeParse(azureResponse()).success, true);

// --- recorded Azure detailed response fixture -------------------------------
const fixture = JSON.parse(
  readFileSync(
    new URL("__fixtures__/azure-pronunciation-response.json", import.meta.url),
    "utf8",
  ),
) as unknown;
assert.equal(azurePronunciationResponseSchema.safeParse(fixture).success, true);
const fixtureReport = mapAzureAssessmentToReport(fixture, {
  ...OPTIONS,
  referenceText: "A good answer uses clear examples.",
});
assert.equal(fixtureReport.status, "scored");
assert.equal(fixtureReport.recognizedText, "A good answer uses clear examples.");
assert.equal(fixtureReport.overall?.pronunciation, 86);
assert.equal(fixtureReport.overall?.accuracy, 83);
assert.equal(fixtureReport.words[1]?.word, "good");
assert.equal(fixtureReport.words[1]?.phonemes[0]?.phoneme, "ɡ");
assert.equal(fixtureReport.words[2]?.errorType, "Mispronunciation");

console.log("scoring/ielts-pronunciation/azure-assessment tests passed");
