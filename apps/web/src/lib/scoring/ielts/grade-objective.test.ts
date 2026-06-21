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

function q(overrides: Partial<GradableQuestion> & Pick<GradableQuestion, "id">): GradableQuestion {
  return {
    skill: "reading",
    questionType: "mcq_single",
    maxPoints: 1,
    wordLimit: null,
    family: "single_select",
    hasOptionBank: false,
    selectCount: null,
    ...overrides,
  };
}

// ---- reading-only attempt: mixed correct/wrong/unanswered + multi ----------
const readingQs: GradableQuestion[] = [
  q({ id: "q1", hasOptionBank: true }),
  q({ id: "q2", questionType: "true_false_notgiven" }),
  q({ id: "q3", questionType: "short_answer", family: "completion" }),
  q({
    id: "q4",
    questionType: "mcq_multi",
    maxPoints: 2,
    family: "multi_select",
    hasOptionBank: true,
    selectCount: 2,
  }),
  // A Writing prompt in scope must be ignored by objective grading.
  q({
    id: "wq",
    skill: "writing",
    questionType: "writing_task2_essay",
    family: "completion",
  }),
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
    q({ id: "l1", skill: "listening", hasOptionBank: true }),
    q({ id: "r1", hasOptionBank: true }),
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
  questions: [q({ id: "x1", hasOptionBank: true })],
  keys: new Map(),
  responses: new Map<string, unknown>([["x1", "a"]]),
  module: "academic",
  bandRows,
});
assert.equal(noKey.readingRaw, 0);
assert.deepEqual(noKey.graded, [{ questionId: "x1", isCorrect: false, awardedPoints: 0 }]);

// ---- raw clamps at 40 even with many multi-point questions -----------------
const manyQs: GradableQuestion[] = Array.from({ length: 25 }, (_, i) => ({
  ...q({
    id: `m${i}`,
    questionType: "mcq_multi",
    maxPoints: 2,
    family: "multi_select",
    hasOptionBank: true,
    selectCount: 2,
  }),
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

// ---- multi-blank renderer envelopes grade through attempt rollup -----------
const rich = gradeObjectiveAttempt({
  questions: [
    q({
      id: "mh",
      questionType: "matching_headings",
      maxPoints: 2,
      family: "matching",
      hasOptionBank: true,
    }),
    q({
      id: "tbl",
      questionType: "note_table_form_flowchart_completion",
      maxPoints: 2,
      family: "completion",
      wordLimit: 2,
    }),
    q({
      id: "map",
      questionType: "map_plan_label",
      maxPoints: 2,
      family: "labeling",
      hasOptionBank: true,
    }),
  ],
  keys: new Map([
    ["mh", key({ h1: "i", h2: "iii" })],
    ["tbl", key({ g1: "solar panel", g2: "battery" }, { g1: ["solar panels"] })],
    ["map", key({ p1: "A", p2: "C" })],
  ]),
  responses: new Map<string, unknown>([
    ["mh", { values: { h1: "i", h2: "ii" } }], // partial matching credit
    ["tbl", { values: { g1: "Solar Panels", g2: "battery" } }], // variant + exact
    ["map", { values: { p1: "A", p2: "C" } }],
  ]),
  module: "academic",
  bandRows,
});
assert.equal(rich.readingRaw, 5);
assert.deepEqual(
  rich.graded.map((g) => [g.questionId, g.isCorrect, g.awardedPoints]).sort(),
  [
    ["map", true, 2],
    ["mh", false, 1],
    ["tbl", true, 2],
  ],
);

console.log("scoring/ielts/grade-objective tests passed");
