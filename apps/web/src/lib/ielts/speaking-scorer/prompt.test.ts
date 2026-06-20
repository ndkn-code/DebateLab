import assert from "node:assert/strict";
import {
  buildSpeakingScorerPrompt,
  type SpeakingScorerGrounding,
} from "./prompt";

const emptyGrounding: SpeakingScorerGrounding = {
  questionSampleAnswer: null,
  examinerNotes: [],
  peerSampleAnswers: [],
};

// --- Part 1, English, no grounding, no phoneme signal -----------------------
const p1 = buildSpeakingScorerPrompt({
  partNumber: 1,
  questionType: "speaking_part1",
  questionPrompt: "Do you work or are you a student?",
  transcript: "I am a student and I study computer science at university.",
  wordCount: 11,
  feedbackLanguage: "en",
  grounding: emptyGrounding,
});
assert.match(p1, /Part 1/);
assert.match(p1, /Do you work or are you a student/); // prompt embedded
assert.match(p1, /I study computer science/); // transcript embedded
// all four criteria keys present
for (const key of [
  "fluencyCoherence",
  "lexicalResource",
  "grammaticalRangeAccuracy",
  "pronunciation",
]) {
  assert.ok(p1.includes(key), `prompt should mention ${key}`);
}
assert.match(p1, /Return ONLY a JSON object/);
assert.match(p1, /excerptFeedback/);
assert.match(p1, /exact lines where marks were lost/);
// transparency: model must NOT compute the overall/average
assert.match(p1, /Do NOT output an overall band/);
// ASR caveat present; no phoneme block when no signal
assert.match(p1, /automatic speech recognition/);
assert.match(p1, /No phoneme analysis is available/);
assert.equal(p1.includes("PHONEME ASSESSMENT"), false);
// no grounding block when empty; no cue card; no duration
assert.equal(p1.includes("GROUNDING"), false);
assert.equal(p1.includes("CUE CARD"), false);
assert.match(p1, /Transcript word count: 11\./);

// --- Part 2, Vietnamese, cue card + grounding + duration + phoneme + warnings
const p2 = buildSpeakingScorerPrompt({
  partNumber: 2,
  questionType: "speaking_part2_cuecard",
  questionPrompt: "Describe a book you enjoyed reading.",
  cueCardBullets: ["what the book was", "why you read it", "how you felt"],
  transcript: "The book I want to talk about is a novel called The Alchemist.",
  wordCount: 120,
  durationSeconds: 90,
  sttWarnings: ["low_confidence"],
  feedbackLanguage: "vi",
  grounding: {
    questionSampleAnswer: "A band 9 long turn covering all bullets.",
    examinerNotes: ["Cover every bullet", "Extend with detail"],
    peerSampleAnswers: ["Another sample long turn."],
  },
  pronunciation: {
    pronunciationScore: 72,
    accuracyScore: 80,
    fluencyScore: 70,
    completenessScore: null,
    prosodyScore: 65,
    mispronouncedWords: ["alchemist", "novel"],
  },
});
assert.match(p2, /Part 2/);
assert.match(p2, /CUE CARD BULLETS/);
assert.match(p2, /what the book was/);
// speech rate computed (120 words / 90s * 60 = 80 wpm)
assert.match(p2, /≈ 80 words\/min/);
// STT warning surfaced
assert.match(p2, /low_confidence/);
// phoneme block rendered + flagged words + "weight it together"
assert.match(p2, /PHONEME ASSESSMENT/);
assert.match(p2, /overall 72\/100/);
assert.match(p2, /accuracy 80\/100/);
assert.match(p2, /Flagged words: alchemist, novel/);
assert.match(p2, /weight it together with the transcript/);
// completeness omitted because null
assert.equal(p2.includes("completeness"), false);
// grounding rendered
assert.match(p2, /GROUNDING/);
assert.match(p2, /A band 9 long turn covering all bullets/);
assert.match(p2, /Cover every bullet/);
assert.match(p2, /Another sample long turn/);
// Vietnamese summary required
assert.match(p2, /Vietnamese-language summary in vietnameseSummary/);
assert.match(p2, /REQUIRED: a clear Vietnamese-language explanation/);

// --- Part 3 context ---------------------------------------------------------
const p3 = buildSpeakingScorerPrompt({
  partNumber: 3,
  questionType: "speaking_part3",
  questionPrompt: "Why do people read less these days?",
  transcript: "I think people read less because of digital distractions.",
  wordCount: 9,
  feedbackLanguage: "en",
  grounding: emptyGrounding,
});
assert.match(p3, /Part 3/);
assert.match(p3, /optional Vietnamese-language explanation/);

console.log("ielts/speaking-scorer/prompt tests passed");
