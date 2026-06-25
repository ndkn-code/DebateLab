import assert from "node:assert/strict";
import {
  getSpeechRevealProgress,
  getSpeechRevealText,
  splitTextForSpeechReveal,
} from "@/lib/tts-playback";

assert.equal(getSpeechRevealProgress(0, 10), 0);
assert.equal(getSpeechRevealProgress(5, 10), 0.5);
assert.equal(getSpeechRevealProgress(11, 10), 1);
assert.equal(getSpeechRevealProgress(5, null), 0);

const text = "abcdef";
assert.equal(
  getSpeechRevealText({ text, currentTimeSeconds: 0, durationSeconds: 10 }),
  ""
);
assert.equal(
  getSpeechRevealText({ text, currentTimeSeconds: 5, durationSeconds: 10 }),
  "abc"
);
assert.equal(
  getSpeechRevealText({ text, currentTimeSeconds: 10, durationSeconds: 10 }),
  text
);

const pausedAtMidpoint = getSpeechRevealText({
  text,
  currentTimeSeconds: 5,
  durationSeconds: 10,
});
assert.equal(
  getSpeechRevealText({ text, currentTimeSeconds: 5, durationSeconds: 10 }),
  pausedAtMidpoint
);
assert.equal(
  getSpeechRevealText({ text, currentTimeSeconds: 8, durationSeconds: 10 }),
  "abcd"
);

const vietnameseWithCombiningMark = "a\u0301b tiếng Việt";
const graphemes = splitTextForSpeechReveal(vietnameseWithCombiningMark, "vi");
assert.equal(graphemes[0], "a\u0301");
assert.equal(
  getSpeechRevealText({
    text: vietnameseWithCombiningMark,
    currentTimeSeconds: 0.1,
    durationSeconds: 10,
    locale: "vi",
  }),
  "a\u0301"
);

console.log("TTS playback projection tests passed");
