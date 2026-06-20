import assert from "node:assert/strict";
import {
  gradeObjectiveAttempt,
  type GradableQuestion,
} from "./grade-objective";
import type { BandConversionRow } from "./band-conversion";
import type { ObjectiveKey } from "./objective-scoring";

const bandRows: BandConversionRow[] = [
  { conversion_key: "default", skill: "reading", module: "academic", band: 2.0, raw_min: 2, raw_max: 3 },
  { conversion_key: "default", skill: "reading", module: "academic", band: 0.0, raw_min: 0, raw_max: 0 },
  { conversion_key: "default", skill: "listening", module: null, band: 1.0, raw_min: 1, raw_max: 1 },
];

function key(correct_answer: unknown, accept_variants: unknown = []): ObjectiveKey {
  return { correct_answer, accept_variants };
}

// ---- reading-only attempt: mixed correct/wrong/unanswered + multi ----------
const readingQs: GradableQuestion[] = [
  { id: "q1", skill: "reading", questionType: "mcq_single", maxPoints: 1, wordLimit: null },
  { id: "q2", skill: "reading", questionType: "true_false_notgiven", maxPoints: 1, wordLimit: null },
  { id: "q3", skill: "reading", questionType: "short_answer", maxPoints: 1, wordLimit: null },
  { id: "q4", skill: "reading", questionType: "mcq_multi", maxPoints: 2, wordLimit: null },
  // A Writing prompt in scope must be ignored by objective grading.
  { id: "wq", skill: "writing", questionType: "writing_task2_essay", maxPoints: 1, wordLimit: null },
];
const readingKeys = new Map<string, ObjectiveKey>([
  ["q1", key("a")],
  ["q2", key("true")],
  ["q3", key("river")],
  ["q4", key(["a", "b"])],
  ["wq", key("ignored")],
]);
const readingResponses = new Map<string, unknown>([
  ["q1", "a"], // correct  +1
  ["q2", "false"], // wrong    +0
  ["q4", { values: ["a", "b"] }], // correct +2
  // q3 unanswered → +0, not in graded[]
]);

const a = gradeObjectiveAttempt({
  questions: readingQs,
  keys: readingKeys,
  responses: readingResponses,
  module: "academic",
  bandRows,
});
assert.equal(a.readingRaw, 3); // 1 + 0 + 2
assert.equal(a.listeningRaw, null); // no listening questions in scope
assert.equal(a.bands.readingBand, 2.0);
assert.equal(a.bands.listeningBand, null);
assert.equal(a.bands.overallBand, 2.0);
// Only answered questions are persisted; the Writing prompt never appears.
assert.deepEqual(
  a.graded.map((g) => [g.questionId, g.isCorrect, g.awardedPoints]).sort(),
  [
    ["q1", true, 1],
    ["q2", false, 0],
    ["q4", true, 2],
  ],
);
assert.equal(a.graded.find((g) => g.questionId === "wq"), undefined);
assert.equal(a.graded.find((g) => g.questionId === "q3"), undefined);

// ---- listening + reading both present --------------------------------------
const both = gradeObjectiveAttempt({
  questions: [
    { id: "l1", skill: "listening", questionType: "mcq_single", maxPoints: 1, wordLimit: null },
    { id: "r1", skill: "reading", questionType: "mcq_single", maxPoints: 1, wordLimit: null },
  ],
  keys: new Map([
    ["l1", key("a")],
    ["r1", key("a")],
  ]),
  responses: new Map<string, unknown>([
    ["l1", "a"],
    ["r1", "wrong"],
  ]),
  module: "academic",
  bandRows,
});
assert.equal(both.listeningRaw, 1);
assert.equal(both.readingRaw, 0);
assert.equal(both.bands.listeningBand, 1.0);
assert.equal(both.bands.readingBand, 0.0);
assert.equal(both.bands.overallBand, 0.5); // mean(1.0, 0.0) = 0.5

// ---- a question with no key falls back to "incorrect" ----------------------
const noKey = gradeObjectiveAttempt({
  questions: [{ id: "x1", skill: "reading", questionType: "mcq_single", maxPoints: 1, wordLimit: null }],
  keys: new Map(),
  responses: new Map<string, unknown>([["x1", "a"]]),
  module: "academic",
  bandRows,
});
assert.equal(noKey.readingRaw, 0);
assert.deepEqual(noKey.graded, [{ questionId: "x1", isCorrect: false, awardedPoints: 0 }]);

// ---- raw clamps at 40 even with many multi-point questions -----------------
const manyQs: GradableQuestion[] = Array.from({ length: 25 }, (_, i) => ({
  id: `m${i}`,
  skill: "reading" as const,
  questionType: "mcq_multi" as const,
  maxPoints: 2,
  wordLimit: null,
}));
const manyKeys = new Map(manyQs.map((q) => [q.id, key(["a", "b"])]));
const manyResponses = new Map<string, unknown>(manyQs.map((q) => [q.id, ["a", "b"]]));
const clamped = gradeObjectiveAttempt({
  questions: manyQs,
  keys: manyKeys,
  responses: manyResponses,
  module: "academic",
  bandRows,
});
assert.equal(clamped.readingRaw, 40); // 25 × 2 = 50 → clamped to 40

console.log("scoring/ielts/grade-objective tests passed");
