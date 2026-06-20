import assert from "node:assert/strict";
import { ieltsSpeakingModelOutputSchema } from "./result-schema";
import { buildSpeakingFeedback, normalizeSpeakingScore } from "./normalize";

const criteria = (
  fc: number,
  lr: number,
  gra: number,
  pron: number,
  rationale = "ok",
) => ({
  fluencyCoherence: { band: fc, rationale },
  lexicalResource: { band: lr, rationale },
  grammaticalRangeAccuracy: { band: gra, rationale },
  pronunciation: { band: pron, rationale },
});

// --- A: full object — snapping, speaking band, trimming, populated payloads --
const rawA = ieltsSpeakingModelOutputSchema.parse({
  criteria: {
    fluencyCoherence: { band: 6.4, rationale: "  steady pace  " },
    lexicalResource: { band: 7, rationale: "good range" },
    grammaticalRangeAccuracy: { band: 6.25, rationale: "mixed accuracy" },
    pronunciation: { band: 6, rationale: "mostly clear" },
  },
  overallSummary: "  Fluent answer.  ",
  strengths: ["  natural pace  "],
  improvements: ["  precise vocab  "],
  excerptFeedback: [
    {
      excerpt: "  the the environment  ",
      criterion: "fluencyCoherence",
      issue: "  repetition  ",
      suggestion: "  the environment  ",
    },
  ],
  vietnameseSummary: "  tốt  ",
});
const a = normalizeSpeakingScore(rawA);
assert.equal(a.criteriaBands.fluencyCoherence, 6.5); // 6.4 -> 6.5
assert.equal(a.criteriaBands.lexicalResource, 7);
assert.equal(a.criteriaBands.grammaticalRangeAccuracy, 6.5); // 6.25 -> 6.5
assert.equal(a.criteriaBands.pronunciation, 6);
assert.equal(a.speakingBand, 6.5); // (6.5+7+6.5+6)/4 = 6.5
assert.equal(a.rationales.fluencyCoherence, "steady pace");
assert.equal(a.summary, "Fluent answer.");
assert.deepEqual(a.strengths, ["natural pace"]);
assert.deepEqual(a.improvements, ["precise vocab"]);
assert.equal(a.excerptFeedback[0].excerpt, "the the environment");
assert.equal(a.excerptFeedback[0].criterion, "fluencyCoherence");
assert.equal(a.excerptFeedback[0].issue, "repetition");
assert.equal(a.excerptFeedback[0].suggestion, "the environment");
assert.equal(a.vietnameseSummary, "tốt");

// --- B: empty arrays (defaults); vn summary omitted -> null -----------------
const rawB = ieltsSpeakingModelOutputSchema.parse({
  criteria: criteria(6, 6, 6, 6),
  overallSummary: "ok",
});
const b = normalizeSpeakingScore(rawB);
assert.equal(b.speakingBand, 6);
assert.deepEqual(b.strengths, []);
assert.deepEqual(b.improvements, []);
assert.deepEqual(b.excerptFeedback, []);
assert.equal(b.vietnameseSummary, null); // omitted -> null

// --- C: blank vietnamese summary trims to null ------------------------------
const rawC = ieltsSpeakingModelOutputSchema.parse({
  criteria: criteria(7, 7, 7, 7),
  overallSummary: "ok",
  vietnameseSummary: "   ",
});
assert.equal(normalizeSpeakingScore(rawC).vietnameseSummary, null);

// --- D: speaking band rounding (.75 -> next whole) --------------------------
const rawD = ieltsSpeakingModelOutputSchema.parse({
  criteria: criteria(6, 7, 7, 7),
  overallSummary: "great",
});
assert.equal(normalizeSpeakingScore(rawD).speakingBand, 7); // 27/4 = 6.75 -> 7

// --- buildSpeakingFeedback envelope -----------------------------------------
const feedbackA = buildSpeakingFeedback(a);
assert.equal(feedbackA.summary, "Fluent answer.");
assert.equal(feedbackA.vietnameseSummary, "tốt");
assert.deepEqual(feedbackA.strengths, ["natural pace"]);
assert.deepEqual(feedbackA.improvements, ["precise vocab"]);
assert.equal(feedbackA.excerpts[0].criterion, "fluencyCoherence");
assert.equal(feedbackA.criteria.fluencyCoherence.band, 6.5);
assert.equal(feedbackA.criteria.fluencyCoherence.rationale, "steady pace");
assert.equal(feedbackA.criteria.pronunciation.band, 6);
assert.deepEqual(Object.keys(feedbackA.criteria), [
  "fluencyCoherence",
  "lexicalResource",
  "grammaticalRangeAccuracy",
  "pronunciation",
]);

const feedbackB = buildSpeakingFeedback(b);
assert.equal(feedbackB.vietnameseSummary, null);
assert.deepEqual(feedbackB.excerpts, []);

console.log("scoring/ielts-speaking/normalize tests passed");
