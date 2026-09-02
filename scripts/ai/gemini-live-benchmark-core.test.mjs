import assert from "node:assert/strict";
import test from "node:test";
import {
  appendZeroPreRoll,
  normalizeTranscript,
  redactHumanTranscriptRows,
  scoreTranscript,
  summarizeBenchmark,
  validateBenchmarkConsent,
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
    {
      status: "failed",
      providers: {
        gemini: {
          status: "ok",
          quality: { wordErrorRate: 0.2, fillerRecall: 0 },
          timing: { finalAfterAudioEndMs: 350 },
        },
        deepgram: { status: "failed" },
      },
    },
  ]);
  assert.equal(summary.cases, 2);
  assert.equal(summary.completedCases, 1);
  assert.equal(summary.gemini.completed, 2);
  assert.equal(summary.gemini.meanFinalAfterAudioEndMs, 300);
  assert.equal(summary.deepgram.completed, 1);
  assert.equal(summary.deepgram.meanWordErrorRate, 0.1);
});

test("consent classification is mandatory and human transcripts are redacted", () => {
  assert.throws(
    () => validateBenchmarkConsent(undefined),
    /explicit synthetic/,
  );
  const consent = validateBenchmarkConsent({
    dataClass: "human_adult_consented",
    containsPersonalData: true,
    speaker: "adult-001",
    consentReference: "consent-receipt-001",
  });
  const rows = redactHumanTranscriptRows(
    [
      {
        providers: {
          gemini: { status: "ok", transcript: "private speech" },
          deepgram: { status: "failed", error: "timeout" },
        },
      },
    ],
    consent,
  );
  assert.equal(rows[0].providers.gemini.transcript, undefined);
  assert.match(rows[0].providers.gemini.transcriptSha256, /^[a-f0-9]{64}$/);
  assert.equal(rows[0].providers.deepgram.error, "timeout");
});
