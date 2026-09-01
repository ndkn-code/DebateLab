import assert from "node:assert/strict";

import {
  areRequiredWritingTasksReady,
  evaluateSimulationCompletion,
  resolveRequiredWritingCompletion,
} from "./simulation-completion";

const base = {
  listeningBand: 7,
  readingBand: 6.5,
  writingBand: 6,
  writingRequired: true,
  speakingBand: null,
  overallBand: 6.5,
};

const writingReady = evaluateSimulationCompletion(base);
assert.equal(writingReady.attemptComplete, true);
assert.equal(writingReady.overallComplete, false);
assert.deepEqual(writingReady.missingRequiredSkills, []);

const missingWriting = evaluateSimulationCompletion({
  ...base,
  writingBand: null,
});
assert.equal(missingWriting.attemptComplete, false);
assert.deepEqual(missingWriting.missingRequiredSkills, ["writing"]);

const missingObjective = evaluateSimulationCompletion({
  ...base,
  listeningBand: null,
  readingBand: null,
});
assert.equal(missingObjective.attemptComplete, false);
assert.deepEqual(missingObjective.missingRequiredSkills, ["listening", "reading"]);

const speakingReady = evaluateSimulationCompletion({
  ...base,
  speakingBand: 6.5,
  overallBand: 6.5,
});
assert.equal(speakingReady.attemptComplete, true);
assert.equal(speakingReady.overallComplete, true);

const partialOverall = evaluateSimulationCompletion({
  ...base,
  speakingBand: null,
  overallBand: 7,
});
assert.equal(partialOverall.attemptComplete, true);
assert.equal(partialOverall.overallComplete, false);

const writingNotInTest = evaluateSimulationCompletion({
  ...base,
  writingBand: null,
  writingRequired: false,
});
assert.equal(writingNotInTest.attemptComplete, true);

const task1 = {
  id: "response-task-1",
  questionId: "writing-task-1",
  taskNumber: 1,
  revision: 0,
  status: "scored",
  taskBand: 6.5,
};
const task2Failed = {
  id: "response-task-2",
  questionId: "writing-task-2",
  taskNumber: 2,
  revision: 0,
  status: "failed",
  taskBand: null,
};

assert.equal(
  areRequiredWritingTasksReady({
    requiredQuestionIds: ["writing-task-1", "writing-task-2"],
    responses: [task1, task2Failed],
    publishedReviews: [],
  }),
  false,
  "one scored Writing task must never complete a two-task simulation",
);

assert.deepEqual(
  resolveRequiredWritingCompletion({
    requiredQuestionIds: ["writing-task-1", "writing-task-2"],
    responses: [task1, { ...task2Failed, status: "scored", taskBand: 7.5 }],
    publishedReviews: [
      {
        writingResponseId: task1.id,
        revision: task1.revision,
        taskBand: 7,
      },
    ],
  }),
  { ready: true, writingBand: 7.5 },
  "the teacher-published task score overrides AI in the weighted Writing band",
);

assert.equal(
  areRequiredWritingTasksReady({
    requiredQuestionIds: ["writing-task-1", "writing-task-2"],
    responses: [task1, task2Failed],
    publishedReviews: [
      {
        writingResponseId: task2Failed.id,
        revision: task2Failed.revision,
        taskBand: 7,
      },
    ],
  }),
  true,
  "a published teacher band can authoritatively complete a failed AI task",
);

assert.equal(
  areRequiredWritingTasksReady({
    requiredQuestionIds: ["writing-task-1", "writing-task-2"],
    responses: [task1, task2Failed],
    publishedReviews: [
      {
        writingResponseId: task2Failed.id,
        revision: 1,
        taskBand: 7,
      },
    ],
  }),
  false,
  "a stale teacher revision must not complete the current response",
);

assert.equal(
  areRequiredWritingTasksReady({
    requiredQuestionIds: ["writing-task-1", "writing-task-2"],
    responses: [task1],
    publishedReviews: [],
  }),
  false,
  "a missing response must not complete a frozen Writing task",
);

console.log("IELTS simulation completion contract tests passed");
