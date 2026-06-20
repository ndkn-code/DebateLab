import assert from "node:assert/strict";
import {
  countWords,
  extractFeedbackSummary,
  formatBand,
  hasPhonemeDetail,
  isPendingStatus,
  isScoredStatus,
  parseSpeakingCaptureValue,
  parseWritingCaptureValue,
  recommendedMinWords,
} from "./capture-format";

// --- countWords --------------------------------------------------------------
assert.equal(countWords(""), 0);
assert.equal(countWords("   "), 0);
assert.equal(countWords("hello"), 1);
assert.equal(countWords("  the   quick brown\nfox "), 4);

// --- recommendedMinWords -----------------------------------------------------
assert.equal(recommendedMinWords("writing_task1_academic"), 150);
assert.equal(recommendedMinWords("writing_task1_general"), 150);
assert.equal(recommendedMinWords("writing_task2_essay"), 250);
assert.equal(recommendedMinWords("speaking_part1"), 150, "unknown → safe default");

// --- status helpers ----------------------------------------------------------
assert.equal(isScoredStatus("scored"), true);
assert.equal(isScoredStatus("overridden"), true);
assert.equal(isScoredStatus("scoring"), false);
assert.equal(isPendingStatus("pending"), true);
assert.equal(isPendingStatus("scoring"), true);
assert.equal(isPendingStatus("scored"), false);
assert.equal(isPendingStatus("failed"), false);

// --- formatBand --------------------------------------------------------------
assert.equal(formatBand(null), "—");
assert.equal(formatBand(6), "6.0");
assert.equal(formatBand(6.5), "6.5");

// --- extractFeedbackSummary --------------------------------------------------
const feedback = { summary: "Good control.", vietnameseSummary: "Kiểm soát tốt." };
assert.equal(extractFeedbackSummary(feedback, "en"), "Good control.");
assert.equal(extractFeedbackSummary(feedback, "vi"), "Kiểm soát tốt.");
// vi falls back to the English summary when no Vietnamese is present.
assert.equal(extractFeedbackSummary({ summary: "Only EN." }, "vi"), "Only EN.");
assert.equal(extractFeedbackSummary({}, "en"), null);
assert.equal(extractFeedbackSummary(null, "en"), null);
assert.equal(extractFeedbackSummary([1, 2], "en"), null, "arrays are not envelopes");
assert.equal(extractFeedbackSummary({ summary: "   " }, "en"), null, "blank → null");

// --- hasPhonemeDetail --------------------------------------------------------
assert.equal(hasPhonemeDetail({ status: "scored", words: [] }), true);
assert.equal(hasPhonemeDetail({ status: "empty" }), false);
assert.equal(hasPhonemeDetail({}), false);
assert.equal(hasPhonemeDetail(null), false);

// --- parseWritingCaptureValue ------------------------------------------------
assert.deepEqual(parseWritingCaptureValue(undefined), {
  essay: "",
  writingResponseId: null,
});
assert.deepEqual(
  parseWritingCaptureValue({ essay: "Hi", writingResponseId: "w1" }),
  { essay: "Hi", writingResponseId: "w1" },
);
assert.deepEqual(parseWritingCaptureValue({ essay: 42 }), {
  essay: "",
  writingResponseId: null,
});
assert.deepEqual(parseWritingCaptureValue("nope"), {
  essay: "",
  writingResponseId: null,
});

// --- parseSpeakingCaptureValue -----------------------------------------------
assert.deepEqual(parseSpeakingCaptureValue(undefined), {
  speakingResponseId: null,
  audioStoragePath: null,
});
assert.deepEqual(
  parseSpeakingCaptureValue({ speakingResponseId: "s1", audioStoragePath: "u/a/x.wav" }),
  { speakingResponseId: "s1", audioStoragePath: "u/a/x.wav" },
);
assert.deepEqual(parseSpeakingCaptureValue({ speakingResponseId: 5 }), {
  speakingResponseId: null,
  audioStoragePath: null,
});

console.log("ielts/capture/capture-format tests passed");
