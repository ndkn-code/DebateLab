import assert from "node:assert/strict";
import {
  WRITING_ERROR_TYPES,
  ieltsWritingModelOutputSchema,
} from "./result-schema";

const criterion = (band: number) => ({ band, rationale: "Because reasons." });

const fullOutput = {
  criteria: {
    taskResponse: criterion(7),
    coherenceCohesion: criterion(6),
    lexicalResource: criterion(7),
    grammaticalRangeAccuracy: criterion(6),
  },
  overallSummary: "A solid response that addresses the task.",
  inlineCorrections: [
    {
      original: "There is many reasons",
      suggestion: "There are many reasons",
      errorType: "grammar" as const,
      explanation: "Subject-verb agreement: 'reasons' is plural.",
      paragraph: 1,
    },
  ],
  paragraphFeedback: [
    {
      paragraph: 0,
      comment: "Clear thesis.",
      strengths: ["Clear position"],
      improvements: ["Add a roadmap sentence"],
    },
  ],
  modelAnswer: "A band 9 rewrite of the essay.",
  vietnameseSummary: "Bài viết khá tốt.",
};

// --- error types ------------------------------------------------------------
assert.deepEqual(WRITING_ERROR_TYPES, [
  "grammar",
  "lexical",
  "cohesion",
  "spelling",
  "punctuation",
  "task",
]);

// --- valid full object ------------------------------------------------------
const parsed = ieltsWritingModelOutputSchema.parse(fullOutput);
assert.equal(parsed.criteria.taskResponse.band, 7);
assert.equal(parsed.inlineCorrections.length, 1);
assert.equal(parsed.vietnameseSummary, "Bài viết khá tốt.");

// --- arrays default to [] when omitted; vn summary optional -----------------
const minimal = ieltsWritingModelOutputSchema.parse({
  criteria: {
    taskResponse: criterion(6),
    coherenceCohesion: criterion(6),
    lexicalResource: criterion(6),
    grammaticalRangeAccuracy: criterion(6),
  },
  overallSummary: "Adequate.",
  modelAnswer: "Rewrite.",
});
assert.deepEqual(minimal.inlineCorrections, []);
assert.deepEqual(minimal.paragraphFeedback, []);
assert.equal(minimal.vietnameseSummary, undefined);

// --- invalid: missing a criterion ------------------------------------------
const missingCriterion = ieltsWritingModelOutputSchema.safeParse({
  criteria: {
    taskResponse: criterion(6),
    coherenceCohesion: criterion(6),
    lexicalResource: criterion(6),
  },
  overallSummary: "x",
  modelAnswer: "y",
});
assert.equal(missingCriterion.success, false);

// --- invalid: non-finite band ----------------------------------------------
const badBand = ieltsWritingModelOutputSchema.safeParse({
  ...fullOutput,
  criteria: {
    ...fullOutput.criteria,
    lexicalResource: { band: Number.POSITIVE_INFINITY, rationale: "x" },
  },
});
assert.equal(badBand.success, false);

// --- invalid: unknown error type -------------------------------------------
const badErrorType = ieltsWritingModelOutputSchema.safeParse({
  ...fullOutput,
  inlineCorrections: [
    {
      original: "a",
      suggestion: "b",
      errorType: "vibes",
      explanation: "nope",
    },
  ],
});
assert.equal(badErrorType.success, false);

// --- invalid: empty model answer -------------------------------------------
const emptyModelAnswer = ieltsWritingModelOutputSchema.safeParse({
  ...fullOutput,
  modelAnswer: "",
});
assert.equal(emptyModelAnswer.success, false);

console.log("scoring/ielts-writing/result-schema tests passed");
