import assert from "node:assert/strict";
import {
  buildWritingScorerPrompt,
  type WritingScorerGrounding,
} from "./prompt";

const emptyGrounding: WritingScorerGrounding = {
  questionModelAnswer: null,
  examinerNotes: [],
  peerModelAnswers: [],
};

// --- Task 2, English, no grounding ------------------------------------------
const t2 = buildWritingScorerPrompt({
  taskNumber: 2,
  taskType: "writing_task2_essay",
  questionPrompt: "Some people think universities should be free.",
  essay: "I strongly agree that university education should be free for all.",
  wordCount: 11,
  feedbackLanguage: "en",
  grounding: emptyGrounding,
});
assert.match(t2, /Writing Task 2/);
assert.match(t2, /universities should be free/); // task prompt embedded
assert.match(t2, /university education should be free for all/); // essay embedded
// all four criteria keys present
for (const key of [
  "taskResponse",
  "coherenceCohesion",
  "lexicalResource",
  "grammaticalRangeAccuracy",
]) {
  assert.ok(t2.includes(key), `prompt should mention ${key}`);
}
assert.match(t2, /modelAnswer/);
assert.match(t2, /Return ONLY a JSON object/);
// transparency: model must NOT compute the overall/average
assert.match(t2, /Do NOT output an overall band/);
// under-length penalty triggered (11 < 250)
assert.match(t2, /under the 250-word minimum/);
// no grounding block when empty
assert.equal(t2.includes("GROUNDING"), false);

// --- Task 1, Vietnamese, with grounding -------------------------------------
const t1 = buildWritingScorerPrompt({
  taskNumber: 1,
  taskType: "writing_task1_academic",
  questionPrompt: "Describe the chart.",
  essay: "The chart shows steady growth across all years of the study period.",
  wordCount: 180,
  feedbackLanguage: "vi",
  grounding: {
    questionModelAnswer: "A band 9 overview with accurate key features.",
    examinerNotes: ["Needs a clear overview", "Group data logically"],
    peerModelAnswers: ["Another exemplar overview."],
  },
});
assert.match(t1, /Writing Task 1/);
assert.match(t1, /at least 150 words/);
// not under length (180 >= 150)
assert.equal(t1.includes("under the 150-word minimum"), false);
// grounding rendered
assert.match(t1, /GROUNDING/);
assert.match(t1, /A band 9 overview with accurate key features/);
assert.match(t1, /Needs a clear overview/);
assert.match(t1, /Another exemplar overview/);
// Vietnamese summary required
assert.match(t1, /Vietnamese-language summary in vietnameseSummary/);
assert.match(t1, /REQUIRED: a clear Vietnamese-language explanation/);

console.log("ielts/writing-scorer/prompt tests passed");
