import assert from "node:assert/strict";
import test from "node:test";
import {
  appendZeroPreRoll,
  normalizeTranscript,
  scoreTranscript,
  summarizeBenchmark,
} from "./gemini-live-benchmark-core.mjs";

test("normalizes punctuation without erasing fillers or repetitions", () => {
  assert.equal(
    normalizeTranscript("Um, I think—I think it is useful."),
    "um i think i think it is useful",
  );
});

test("scores word error rate and repeated filler recall", () => {
  const score = scoreTranscript("Um uh uh I agree", "uh I agree");
  assert.equal(score.referenceWords, 5);
  assert.equal(score.edits, 2);
  assert.equal(score.wordErrorRate, 0.4);
  assert.equal(score.fillerExpected, 3);
  assert.equal(score.fillerMatched, 1);
  assert.equal(score.fillerRecall, 1 / 3);
});

test("adds an exact 300 ms 16 kHz PCM pre-roll", () => {
  const source = Buffer.from([1, 2, 3, 4]);
  const result = appendZeroPreRoll(source);
  assert.equal(result.length, 9_600 + source.length);
  assert.deepEqual(result.subarray(-4), source);
});

test("summarizes only successful provider observations", () => {
  const summary = summarizeBenchmark([
    {
      status: "ok",
      providers: {
        gemini: {
          status: "ok",
          quality: { wordErrorRate: 0, fillerRecall: 1 },
          timing: { finalAfterAudioEndMs: 250 },
        },
        deepgram: {
          status: "ok",
          quality: { wordErrorRate: 0.1, fillerRecall: 0.5 },
          timing: { finalAfterAudioEndMs: 750 },
        },
      },
    },
    { status: "failed", providers: {} },
  ]);
  assert.equal(summary.cases, 2);
  assert.equal(summary.completedCases, 1);
  assert.equal(summary.gemini.meanFinalAfterAudioEndMs, 250);
  assert.equal(summary.deepgram.meanWordErrorRate, 0.1);
});
