import assert from "node:assert/strict";

import {
  cueCardTiming,
  elapsedPercent,
  formatCountdown,
  isCueCardQuestionType,
  speakingCaptureContext,
  speakingGuidanceKey,
} from "./speaking-guidance";

assert.equal(speakingGuidanceKey("speaking_part1"), "speaking.part1Hint");
assert.equal(speakingGuidanceKey("speaking_part2_cuecard"), "speaking.part2Hint");
assert.equal(speakingGuidanceKey("speaking_part3"), "speaking.part3Hint");
assert.equal(speakingGuidanceKey("writing_task2_essay"), "speaking.intro");

assert.equal(isCueCardQuestionType("speaking_part2_cuecard"), true);
assert.equal(isCueCardQuestionType("speaking_part1"), false);

assert.equal(formatCountdown(0), "0:00");
assert.equal(formatCountdown(59), "0:59");
assert.equal(formatCountdown(60), "1:00");
assert.equal(formatCountdown(125.9), "2:05");
assert.equal(formatCountdown(-4), "0:00");
assert.equal(formatCountdown(Number.NaN), "0:00");

assert.equal(elapsedPercent(0, 120), 0);
assert.equal(elapsedPercent(60, 120), 50);
assert.equal(elapsedPercent(500, 120), 100);
assert.equal(elapsedPercent(10, 0), 0);
assert.equal(elapsedPercent(Number.NaN, 120), 0);

console.log("speaking-guidance tests passed");

// cueCardTiming — authored seconds win; defaults (60 / 120) when absent; non-Part-2 ignores the card.
const authored = cueCardTiming({
  questionType: "speaking_part2_cuecard",
  cueCard: {
    topic: "Describe a place",
    bullets: ["where it is"],
    prepSeconds: 45,
    speakSeconds: 90,
  },
});
assert.equal(authored.isCueCard, true);
assert.equal(authored.prepSeconds, 45);
assert.equal(authored.speakSeconds, 90);
const defaults = cueCardTiming({ questionType: "speaking_part2_cuecard", cueCard: null });
assert.deepEqual(defaults, {
  isCueCard: true,
  cueCard: null,
  prepSeconds: 60,
  speakSeconds: 120,
});
const part1 = cueCardTiming({
  questionType: "speaking_part1",
  cueCard: { topic: "x", bullets: ["y"], prepSeconds: 5, speakSeconds: 5 },
});
assert.equal(part1.isCueCard, false);
assert.equal(part1.cueCard, null);

// speakingCaptureContext
assert.deepEqual(speakingCaptureContext(undefined), { attemptId: null, isSimulation: false });
assert.deepEqual(speakingCaptureContext({ attemptId: "a1", assessmentMode: "simulation" }), {
  attemptId: "a1",
  isSimulation: true,
});
assert.deepEqual(speakingCaptureContext({ attemptId: "a1", assessmentMode: "practice" }), {
  attemptId: "a1",
  isSimulation: false,
});

console.log("speaking-guidance timing tests passed");
