import assert from "node:assert/strict";
import {
  SPEAKING_CRITERION_ENUM,
  ieltsSpeakingModelOutputSchema,
} from "./result-schema";

const criterion = (band: number) => ({ band, rationale: "Because reasons." });

const fullCriteria = {
  fluencyCoherence: criterion(7),
  lexicalResource: criterion(6),
  grammaticalRangeAccuracy: criterion(7),
  pronunciation: criterion(6),
};

const fullOutput = {
  criteria: fullCriteria,
  overallSummary: "A fluent answer that develops the topic well.",
  strengths: ["Natural pace", "Good range of connectives"],
  improvements: ["Reduce self-correction", "Use more precise vocabulary"],
  excerptFeedback: [
    {
      excerpt: "I think that, um, the, the environment is important",
      criterion: "fluencyCoherence" as const,
      issue: "Repetition and hesitation break the flow.",
      suggestion: "The environment matters because…",
    },
  ],
  vietnameseSummary: "Phần nói khá trôi chảy.",
};

// --- criterion enum ---------------------------------------------------------
assert.deepEqual(SPEAKING_CRITERION_ENUM.options, [
  "fluencyCoherence",
  "lexicalResource",
  "grammaticalRangeAccuracy",
  "pronunciation",
]);

// --- valid full object ------------------------------------------------------
const parsed = ieltsSpeakingModelOutputSchema.parse(fullOutput);
assert.equal(parsed.criteria.fluencyCoherence.band, 7);
assert.equal(parsed.excerptFeedback.length, 1);
assert.equal(parsed.strengths.length, 2);
assert.equal(parsed.vietnameseSummary, "Phần nói khá trôi chảy.");

// --- arrays default to [] when omitted; vn summary optional -----------------
const minimal = ieltsSpeakingModelOutputSchema.parse({
  criteria: fullCriteria,
  overallSummary: "Adequate.",
});
assert.deepEqual(minimal.strengths, []);
assert.deepEqual(minimal.improvements, []);
assert.deepEqual(minimal.excerptFeedback, []);
assert.equal(minimal.vietnameseSummary, undefined);

// --- empty suggestion is allowed (suggestion has no min length) -------------
const emptySuggestion = ieltsSpeakingModelOutputSchema.safeParse({
  ...fullOutput,
  excerptFeedback: [
    {
      excerpt: "well",
      criterion: "pronunciation" as const,
      issue: "Unclear /θ/ sound.",
      suggestion: "",
    },
  ],
});
assert.equal(emptySuggestion.success, true);

// --- invalid: missing a criterion ------------------------------------------
const missingCriterion = ieltsSpeakingModelOutputSchema.safeParse({
  criteria: {
    fluencyCoherence: criterion(6),
    lexicalResource: criterion(6),
    grammaticalRangeAccuracy: criterion(6),
  },
  overallSummary: "x",
});
assert.equal(missingCriterion.success, false);

// --- invalid: non-finite band ----------------------------------------------
const badBand = ieltsSpeakingModelOutputSchema.safeParse({
  ...fullOutput,
  criteria: {
    ...fullCriteria,
    pronunciation: { band: Number.POSITIVE_INFINITY, rationale: "x" },
  },
});
assert.equal(badBand.success, false);

// --- invalid: unknown criterion in excerpt ---------------------------------
const badCriterion = ieltsSpeakingModelOutputSchema.safeParse({
  ...fullOutput,
  excerptFeedback: [
    {
      excerpt: "a",
      criterion: "vibes",
      issue: "nope",
      suggestion: "b",
    },
  ],
});
assert.equal(badCriterion.success, false);

// --- invalid: empty overall summary ----------------------------------------
const emptySummary = ieltsSpeakingModelOutputSchema.safeParse({
  ...fullOutput,
  overallSummary: "",
});
assert.equal(emptySummary.success, false);

console.log("scoring/ielts-speaking/result-schema tests passed");
