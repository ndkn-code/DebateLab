import assert from "node:assert/strict";

import {
  isChecklistComplete,
  summarizeWritingTasks,
  toggleChecklistIndex,
  writingProgressPercent,
  writingTaskNumber,
} from "./writing-part";

// writingTaskNumber — task types map to 1/2, anything else keeps the ordinal.
assert.equal(writingTaskNumber("writing_task1_academic", 9), 1);
assert.equal(writingTaskNumber("writing_task2_essay", 9), 2);
assert.equal(writingTaskNumber("speaking_part1", 3), 3);

// summarizeWritingTasks — reads the persisted capture value shape.
const summaries = summarizeWritingTasks(
  [
    { id: "q1", questionType: "writing_task1_academic" },
    { id: "q2", questionType: "writing_task2_essay" },
  ],
  {
    q1: { essay: "one two three four five", writingResponseId: null },
    q2: undefined,
  },
);
assert.equal(summaries.length, 2);
assert.deepEqual(summaries[0], {
  questionId: "q1",
  taskNumber: 1,
  words: 5,
  minWords: 150,
  minWordsMet: false,
});
assert.equal(summaries[1].taskNumber, 2);
assert.equal(summaries[1].words, 0);
assert.equal(summaries[1].minWords, 250);
assert.equal(summaries[1].minWordsMet, false);

const met = summarizeWritingTasks(
  [{ id: "q", questionType: "writing_task1_academic" }],
  { q: { essay: Array.from({ length: 150 }, () => "w").join(" ") } },
);
assert.equal(met[0].minWordsMet, true);

// writingProgressPercent — clamped 0..100, rounded.
assert.equal(writingProgressPercent(0, 150), 0);
assert.equal(writingProgressPercent(75, 150), 50);
assert.equal(writingProgressPercent(400, 250), 100);
assert.equal(writingProgressPercent(3, 0), 100);
assert.equal(writingProgressPercent(0, 0), 0);

// toggleChecklistIndex — pure, sorted, idempotent round-trip.
assert.deepEqual(toggleChecklistIndex([], 2), [2]);
assert.deepEqual(toggleChecklistIndex([2], 0), [0, 2]);
assert.deepEqual(toggleChecklistIndex([0, 2], 2), [0]);
const frozen: ReadonlyArray<number> = [1];
toggleChecklistIndex(frozen, 0);
assert.deepEqual(frozen, [1]);

// isChecklistComplete — ignores out-of-range/duplicate indices.
assert.equal(isChecklistComplete([], 0), false);
assert.equal(isChecklistComplete([0, 1], 3), false);
assert.equal(isChecklistComplete([0, 1, 2], 3), true);
assert.equal(isChecklistComplete([0, 0, 1, 2, 7], 3), true);

console.log("writing-part tests passed");
