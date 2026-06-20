import assert from "node:assert/strict";
import { ieltsWritingModelOutputSchema } from "./result-schema";
import { buildCriteriaFeedback, normalizeWritingScore } from "./normalize";

const criteria = (
  tr: number,
  cc: number,
  lr: number,
  gra: number,
  rationale = "ok",
) => ({
  taskResponse: { band: tr, rationale },
  coherenceCohesion: { band: cc, rationale },
  lexicalResource: { band: lr, rationale },
  grammaticalRangeAccuracy: { band: gra, rationale },
});

// --- A: full object — snapping, task band, trimming, populated payloads -----
const rawA = ieltsWritingModelOutputSchema.parse({
  criteria: {
    taskResponse: { band: 6.4, rationale: "  addresses the task  " },
    coherenceCohesion: { band: 7, rationale: "well organized" },
    lexicalResource: { band: 6.25, rationale: "good range" },
    grammaticalRangeAccuracy: { band: 6, rationale: "some errors" },
  },
  overallSummary: "  Good essay.  ",
  inlineCorrections: [
    {
      original: "  There is many  ",
      suggestion: "  There are many  ",
      errorType: "grammar",
      explanation: "  agreement  ",
      paragraph: 2,
    },
  ],
  paragraphFeedback: [
    {
      paragraph: 0,
      comment: "  clear thesis  ",
      strengths: ["  thesis  "],
      improvements: ["  roadmap  "],
    },
  ],
  modelAnswer: "  band 9 rewrite  ",
  vietnameseSummary: "  tốt  ",
});
const a = normalizeWritingScore(rawA);
assert.equal(a.criteriaBands.taskResponse, 6.5); // 6.4 -> 6.5
assert.equal(a.criteriaBands.coherenceCohesion, 7);
assert.equal(a.criteriaBands.lexicalResource, 6.5); // 6.25 -> 6.5
assert.equal(a.criteriaBands.grammaticalRangeAccuracy, 6);
assert.equal(a.taskBand, 6.5); // (6.5+7+6.5+6)/4 = 6.5
assert.equal(a.rationales.taskResponse, "addresses the task");
assert.equal(a.summary, "Good essay.");
assert.equal(a.inlineCorrections[0].original, "There is many");
assert.equal(a.inlineCorrections[0].suggestion, "There are many");
assert.equal(a.inlineCorrections[0].explanation, "agreement");
assert.equal(a.inlineCorrections[0].errorType, "grammar");
assert.equal(a.inlineCorrections[0].paragraph, 2);
assert.equal(a.paragraphFeedback[0].comment, "clear thesis");
assert.deepEqual(a.paragraphFeedback[0].strengths, ["thesis"]);
assert.deepEqual(a.paragraphFeedback[0].improvements, ["roadmap"]);
assert.equal(a.modelAnswer, "band 9 rewrite");
assert.equal(a.vietnameseSummary, "tốt");

// --- B: correction without paragraph; feedback without strengths/improvements
const rawB = ieltsWritingModelOutputSchema.parse({
  criteria: criteria(6, 6, 6, 6),
  overallSummary: "ok",
  inlineCorrections: [
    { original: "a", suggestion: "b", errorType: "lexical", explanation: "c" },
  ],
  paragraphFeedback: [{ paragraph: 1, comment: "hmm" }],
  modelAnswer: "m",
});
const b = normalizeWritingScore(rawB);
assert.equal(b.taskBand, 6);
assert.equal(b.inlineCorrections[0].paragraph, null);
assert.deepEqual(b.paragraphFeedback[0].strengths, []);
assert.deepEqual(b.paragraphFeedback[0].improvements, []);
assert.equal(b.vietnameseSummary, null); // omitted -> null

// --- C: blank vietnamese summary trims to null ------------------------------
const rawC = ieltsWritingModelOutputSchema.parse({
  criteria: criteria(7, 7, 7, 7),
  overallSummary: "ok",
  modelAnswer: "m",
  vietnameseSummary: "   ",
});
assert.equal(normalizeWritingScore(rawC).vietnameseSummary, null);

// --- D: empty feedback arrays (defaults) ------------------------------------
const rawD = ieltsWritingModelOutputSchema.parse({
  criteria: criteria(8, 8, 8, 8),
  overallSummary: "great",
  modelAnswer: "m",
});
const d = normalizeWritingScore(rawD);
assert.deepEqual(d.inlineCorrections, []);
assert.deepEqual(d.paragraphFeedback, []);
assert.equal(d.taskBand, 8);

// --- buildCriteriaFeedback envelope -----------------------------------------
const feedbackA = buildCriteriaFeedback(a);
assert.equal(feedbackA.summary, "Good essay.");
assert.equal(feedbackA.vietnameseSummary, "tốt");
assert.equal(feedbackA.criteria.taskResponse.band, 6.5);
assert.equal(feedbackA.criteria.taskResponse.rationale, "addresses the task");
assert.equal(feedbackA.criteria.grammaticalRangeAccuracy.band, 6);
assert.deepEqual(Object.keys(feedbackA.criteria), [
  "taskResponse",
  "coherenceCohesion",
  "lexicalResource",
  "grammaticalRangeAccuracy",
]);

const feedbackB = buildCriteriaFeedback(b);
assert.equal(feedbackB.vietnameseSummary, null);

console.log("scoring/ielts-writing/normalize tests passed");
