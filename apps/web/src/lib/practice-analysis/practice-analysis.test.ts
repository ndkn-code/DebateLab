import assert from "node:assert/strict";
import { getPracticeFeedbackEvaluator } from "./evaluators";
import { getPracticeFeedbackPromptManifest } from "./prompt-bundles";
import {
  buildPracticeAttemptSnapshot,
  createPracticeInputHash,
} from "./snapshot";
import { englishDebateFeedback, englishDebateInput } from "./__fixtures__/english-debate";
import {
  vietnameseSpeakingFeedback,
  vietnameseSpeakingInput,
} from "./__fixtures__/vietnamese-speaking";

const capturedAt = "2026-05-20T18:00:00.000Z";
const firstSnapshot = buildPracticeAttemptSnapshot(englishDebateInput, capturedAt);
const secondSnapshot = buildPracticeAttemptSnapshot(englishDebateInput, capturedAt);

assert.deepEqual(firstSnapshot, secondSnapshot);
assert.equal(firstSnapshot.schemaVersion, 1);
assert.equal(firstSnapshot.analysisParams.practiceTrack, "debate");
assert.equal(firstSnapshot.session.topicCategory, "Education");
assert.equal(firstSnapshot.analysisParams.debateMemory ?? null, null);

const baseHash = createPracticeInputHash(englishDebateInput);
const changedHash = createPracticeInputHash({
  ...englishDebateInput,
  transcript: `${englishDebateInput.transcript} One more sentence changes the immutable input.`,
});
assert.equal(baseHash.length, 64);
assert.notEqual(baseHash, changedHash);

const debateManifest = getPracticeFeedbackPromptManifest(englishDebateInput);
assert.equal(debateManifest.promptBundleKey, "practice_feedback");
assert.equal(debateManifest.promptBundleVersion, 4);
assert.equal(debateManifest.rubricKey, "debate_v1");
assert.equal(debateManifest.evaluatorKey, "debate_feedback_v1");
assert.equal(debateManifest.promptHash.length, 64);
assert.ok(debateManifest.prompt.includes("Schools should ban phones"));
assert.ok(debateManifest.prompt.includes("Motion Definition"));
assert.ok(debateManifest.prompt.includes("scoreRationale"));

const speakingManifest = getPracticeFeedbackPromptManifest(vietnameseSpeakingInput);
assert.equal(speakingManifest.rubricKey, "speaking_v1");
assert.equal(speakingManifest.evaluatorKey, "speaking_feedback_v1");
assert.ok(speakingManifest.prompt.includes("Practice Language"));

assert.equal(getPracticeFeedbackEvaluator(englishDebateInput).key, "debate_feedback_v1");
assert.equal(
  getPracticeFeedbackEvaluator(vietnameseSpeakingInput).key,
  "speaking_feedback_v1"
);

assert.equal(englishDebateFeedback.practiceTrack, "debate");
assert.equal(vietnameseSpeakingFeedback.practiceLanguage, "vi");

console.log("practice-analysis utilities passed");
