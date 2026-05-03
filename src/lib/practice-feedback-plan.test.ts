import assert from "node:assert/strict";
import {
  DUEL_REBUTTAL_DURATION,
  SOLO_PREP_DURATION,
  SOLO_SPEECH_DURATION,
  clampDurationSeconds,
  minutesToSeconds,
} from "./practice-durations";
import {
  buildTranscriptChunks,
  estimateTranscriptTimestamp,
  filterTranscriptAnnotationMatches,
  formatTranscriptTimestamp,
  getTranscriptAnnotationAccent,
  locateTranscriptAnnotations,
  normalizeTranscriptAnnotations,
} from "./feedback/annotations";

assert.equal(clampDurationSeconds(0, SOLO_PREP_DURATION), 60);
assert.equal(clampDurationSeconds(999, SOLO_PREP_DURATION), 600);
assert.equal(clampDurationSeconds(95, SOLO_PREP_DURATION), 120);
assert.equal(clampDurationSeconds(481, SOLO_SPEECH_DURATION), 420);
assert.equal(clampDurationSeconds(45, DUEL_REBUTTAL_DURATION), 60);
assert.equal(minutesToSeconds(7, SOLO_SPEECH_DURATION), 420);
assert.equal(minutesToSeconds(12, SOLO_PREP_DURATION), 600);

const transcript =
  "First, we must protect students from harm. This matters because schools shape daily habits.\nSecond, the policy creates accountability.";

const annotations = normalizeTranscriptAnnotations([
  {
    quote: "protect students from harm",
    tag: "impact",
    severity: "strength",
    feedback: "Clear impact framing.",
    suggestion: "Keep this impact, then compare it against the other side.",
  },
  {
    quote: "daily habits. Second, the policy",
    tag: "mechanism",
    severity: "unknown",
    feedback: "This transition needs a clearer mechanism.",
    suggestion: "Explain how the policy changes behavior before moving on.",
  },
  {
    quote: "",
    feedback: "Ignore invalid entries.",
  },
]);

assert.equal(annotations.length, 2);
assert.equal(annotations[1].severity, "improvement");

const matches = locateTranscriptAnnotations(transcript, annotations);
assert.equal(matches.length, 2);
assert.equal(matches[0].matchedText, "protect students from harm");
assert.equal(matches[0].start, 15);
assert.equal(
  matches[1].matchedText,
  "daily habits.\nSecond, the policy"
);

const unmatched = locateTranscriptAnnotations(transcript, [
  {
    quote: "this quote does not appear",
    tag: "logic",
    severity: "warning",
    feedback: "Unmatched quotes should still render as cards.",
    suggestion: "Choose an exact transcript quote next time.",
  },
]);
assert.equal(unmatched[0].start, null);
assert.equal(unmatched[0].matchedText, null);
assert.equal(formatTranscriptTimestamp(65.9), "1:05");
assert.equal(estimateTranscriptTimestamp(60, 120, 180), "1:30");
assert.equal(estimateTranscriptTimestamp(null, 120, 180), null);
assert.equal(filterTranscriptAnnotationMatches(matches, "all").length, 2);
assert.equal(filterTranscriptAnnotationMatches(matches, "strength").length, 1);
assert.equal(filterTranscriptAnnotationMatches(matches, "warning").length, 0);

const chunkedTranscript =
  "First, students lose attention when phones buzz. Teachers then restart explanations. This costs learning time. Second, a shared rule is fairer because every classroom has the same expectation. Finally, the policy protects deep work.";
const chunks = buildTranscriptChunks(chunkedTranscript, 240);
assert.equal(chunks.length, 2);
assert.equal(chunks[0].timestampLabel, "0:00");
assert.ok(chunks[0].text.includes("This costs learning time."));
assert.equal(getTranscriptAnnotationAccent("evidence"), "#34C759");
assert.equal(getTranscriptAnnotationAccent("clash"), "#F5B942");
assert.notEqual(
  getTranscriptAnnotationAccent("evidence"),
  getTranscriptAnnotationAccent("clash")
);

console.log("practice-feedback-plan utilities passed");
