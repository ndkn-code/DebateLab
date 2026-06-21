import assert from "node:assert/strict";
import {
  buildSpeakingResult,
  buildWritingResult,
  feedbackSkillStatus,
} from "./skill-feedback";
import type { ResultsSpeakingPart, ResultsWritingTask } from "./types";

function writingTask(p: Partial<ResultsWritingTask>): ResultsWritingTask {
  return {
    questionId: "w",
    prompt: "Discuss both views.",
    taskNumber: 2,
    status: "scored",
    essay: "This essay is mostly clear.\n\nIt has one error.",
    wordCount: 260,
    taskResponseBand: 7,
    coherenceCohesionBand: 6.5,
    lexicalResourceBand: 7,
    grammarBand: 6.5,
    taskBand: 7,
    criteriaFeedback: {},
    inlineCorrections: [],
    paragraphFeedback: [],
    modelAnswer: null,
    feedbackLanguage: "en",
    ...p,
  };
}

// ---- Writing: criteria, summary, corrections, task-2-weighted band ---------
const writing = buildWritingResult([
  writingTask({ questionId: "w2", taskNumber: 2, taskBand: 7 }),
  writingTask({
    questionId: "w1",
    taskNumber: 1,
    taskBand: 6,
    taskResponseBand: 6,
    criteriaFeedback: {
      summary: "Solid overview.",
      vietnameseSummary: "Tổng quan tốt.",
      criteria: { taskResponse: { band: 6, rationale: "Covers key features." } },
    },
    inlineCorrections: [
      { original: "is", suggestion: "are", errorType: "grammar", explanation: "agreement", paragraph: 1 },
    ],
    paragraphFeedback: [{ paragraph: 0, comment: "Clear intro", strengths: ["clear"], improvements: ["hook"] }],
    modelAnswer: "Band 9 rewrite.",
  }),
]);
assert.ok(writing);
// (Task1 6 + 2·Task2 7) / 3 = 6.67 -> 6.5
assert.equal(writing.band, 6.5);
assert.equal(writing.isComplete, true);
assert.equal(writing.anyPending, false);
// Sorted Task 1 then Task 2.
assert.deepEqual(writing.tasks.map((t) => t.taskNumber), [1, 2]);
const task1 = writing.tasks[0];
assert.equal(task1.criteria[0].key, "taskResponse");
assert.equal(task1.criteria[0].label, "Task Response / Achievement");
assert.equal(task1.criteria[0].band, 6);
assert.equal(task1.criteria[0].rationale, "Covers key features.");
assert.equal(task1.summary, "Solid overview.");
assert.equal(task1.vietnameseSummary, "Tổng quan tốt.");
assert.equal(task1.inlineCorrections.length, 1);
assert.equal(task1.inlineCorrections[0].errorType, "grammar");
assert.equal(task1.paragraphFeedback[0].strengths[0], "clear");
assert.equal(task1.essayParagraphs.length, 2);
assert.equal(task1.essayParagraphs[0].feedback?.comment, "Clear intro");
assert.equal(task1.essayParagraphs[0].corrections[0].suggestion, "are");
assert.equal(task1.modelAnswer, "Band 9 rewrite.");

// ---- Writing in progress: empty envelope degrades to nulls -----------------
const scoring = buildWritingResult([
  writingTask({
    status: "scoring",
    taskResponseBand: null,
    coherenceCohesionBand: null,
    lexicalResourceBand: null,
    grammarBand: null,
    taskBand: null,
  }),
]);
assert.ok(scoring);
assert.equal(scoring.band, null);
assert.equal(scoring.isComplete, false);
assert.equal(scoring.anyPending, true);
assert.equal(scoring.tasks[0].criteria[0].band, null);
assert.equal(scoring.tasks[0].criteria[0].rationale, null);
assert.equal(scoring.tasks[0].summary, null);

// No tasks -> null result.
assert.equal(buildWritingResult([]), null);

// ---- Speaking: mean of scored part bands, criteria projected ---------------
function speakingPart(p: Partial<ResultsSpeakingPart>): ResultsSpeakingPart {
  return {
    questionId: "s",
    prompt: "Where do you live?",
    partNumber: 1,
    status: "scored",
    transcript: "I live in a quiet apartment.",
    fluencyCoherenceBand: 7,
    lexicalResourceBand: 7,
    grammarBand: 6.5,
    pronunciationBand: 7,
    speakingBand: 7,
    feedback: {},
    feedbackLanguage: "en",
    modelAnswer: null,
    phonemeReport: {},
    ...p,
  };
}
const speaking = buildSpeakingResult([
  speakingPart({
    questionId: "s1",
    partNumber: 1,
    speakingBand: 7,
    feedback: { summary: "Fluent." },
    modelAnswer: "Band 9 spoken sample.",
    phonemeReport: {
      schemaVersion: 1,
      status: "scored",
      provider: "azure",
      model: "pronunciation-assessment",
      locale: "en-US",
      referenceText: "I live in a quiet apartment.",
      recognizedText: "I live in a quiet apartment.",
      overall: {
        accuracy: 88,
        fluency: 82,
        completeness: 100,
        prosody: null,
        pronunciation: 87,
      },
      words: [
        {
          word: "quiet",
          accuracy: 68,
          errorType: "Mispronunciation",
          phonemes: [
            { phoneme: "k", accuracy: 90 },
            { phoneme: "aɪ", accuracy: 61 },
          ],
        },
      ],
    },
  }),
  speakingPart({ questionId: "s2", partNumber: 2, speakingBand: 6 }),
]);
assert.ok(speaking);
assert.equal(speaking.band, 6.5); // mean (7+6)/2
assert.equal(speaking.parts.length, 2);
assert.deepEqual(speaking.parts.map((part) => part.partNumber), [1, 2]);
assert.equal(speaking.parts[0].criteria[3].key, "pronunciation");
assert.equal(speaking.parts[0].summary, "Fluent.");
assert.equal(speaking.parts[0].modelAnswer, "Band 9 spoken sample.");
assert.equal(speaking.parts[0].pronunciationHeatmap?.words[0].level, "focus");
assert.equal(speaking.parts[0].pronunciationHeatmap?.words[0].phonemes[0].level, "strong");
assert.equal(speaking.parts[1].pronunciationHeatmap, null);
assert.equal(buildSpeakingResult([]), null);

// ---- feedbackSkillStatus ---------------------------------------------------
assert.equal(feedbackSkillStatus(null), "not_attempted");
assert.equal(feedbackSkillStatus({ isComplete: true, anyPending: false }), "scored");
assert.equal(feedbackSkillStatus({ isComplete: false, anyPending: true }), "in_progress");

console.log("ielts/results/skill-feedback tests passed");
