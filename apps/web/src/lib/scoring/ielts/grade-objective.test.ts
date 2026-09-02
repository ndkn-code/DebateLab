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

// ---- any-order groups -------------------------------------------------------
const anyOrder = new Map([["g1", { anyOrder: true }]]);
function saq(id: string, extra: Partial<GradableQuestion> = {}): GradableQuestion {
  return q({
    id,
    questionType: "short_answer",
    family: "completion",
    wordLimit: 1,
    groupKey: "g1",
    ...extra,
  });
}
const setKeys = new Map<string, ObjectiveKey>([
  ["s1", key("garden")],
  ["s2", key("kitchen")],
  ["s3", key("roof")],
]);
function gradeSet(
  responses: Map<string, unknown>,
  groups: ReadonlyMap<string, { anyOrder: boolean }> | null = anyOrder,
  questions: GradableQuestion[] = [saq("s1"), saq("s2"), saq("s3")],
  keys: ReadonlyMap<string, ObjectiveKey> = setKeys,
) {
  // `null` = legacy caller that passes no `groups` at all.
  const grade = gradeObjectiveAttempt({
    questions,
    keys,
    responses,
    module: "academic",
    bandRows,
    ...(groups ? { groups } : {}),
  });
  return {
    raw: grade.readingRaw,
    graded: grade.graded.map((g) => [g.questionId, g.isCorrect, g.awardedPoints]),
  };
}

// answers in a different order than the key → full marks
assert.deepEqual(
  gradeSet(new Map<string, unknown>([["s1", "roof"], ["s2", "garden"], ["s3", "kitchen"]])),
  { raw: 3, graded: [["s1", true, 1], ["s2", true, 1], ["s3", true, 1]] },
);
// a duplicated learner answer counts once; credit goes to the first answered rows
assert.deepEqual(
  gradeSet(new Map<string, unknown>([["s1", "garden"], ["s2", "Garden"], ["s3", "sky"]])),
  { raw: 1, graded: [["s1", true, 1], ["s2", false, 0], ["s3", false, 0]] },
);
// three correct alternatives but only two rows → capped at 2
assert.deepEqual(
  gradeSet(
    new Map<string, unknown>([["s1", "roof"], ["s2", "garden"]]),
    anyOrder,
    [saq("s1"), saq("s2")],
    new Map([
      ["s1", key("garden/kitchen/roof")],
      ["s2", key("garden/kitchen/roof")],
    ]),
  ),
  { raw: 2, graded: [["s1", true, 1], ["s2", true, 1]] },
);
// alternatives of ONE answer never earn two marks
assert.deepEqual(
  gradeSet(
    new Map<string, unknown>([["s1", "colour"], ["s2", "color"]]),
    anyOrder,
    [saq("s1"), saq("s2")],
    new Map([
      ["s1", key("colour", ["color"])],
      ["s2", key("kitchen")],
    ]),
  ),
  { raw: 1, graded: [["s1", true, 1], ["s2", false, 0]] },
);
// unanswered first row still lets row 2 earn credit (and stays out of graded[])
assert.deepEqual(
  gradeSet(new Map<string, unknown>([["s2", "garden"], ["s3", "sky"]])),
  { raw: 1, graded: [["s2", true, 1], ["s3", false, 0]] },
);
// an over-limit value is excluded from the pool match
assert.deepEqual(
  gradeSet(new Map<string, unknown>([["s1", "the big garden"], ["s2", "garden"], ["s3", "roof"]])),
  { raw: 2, graded: [["s1", true, 1], ["s2", true, 1], ["s3", false, 0]] },
);
// …unless the row grants "AND/OR A NUMBER" and the extra token is a number
assert.deepEqual(
  gradeSet(
    new Map<string, unknown>([["s1", "3 weeks"], ["s2", "garden"]]),
    anyOrder,
    [saq("s1", { allowNumber: true }), saq("s2", { allowNumber: true })],
    new Map([
      ["s1", key("garden")],
      ["s2", key("3 weeks")],
    ]),
  ),
  { raw: 2, graded: [["s1", true, 1], ["s2", true, 1]] },
);
// a group that is NOT any-order keeps row-wise marking
assert.deepEqual(
  gradeSet(
    new Map<string, unknown>([["s1", "kitchen"], ["s2", "garden"], ["s3", "roof"]]),
    new Map([["g1", { anyOrder: false }]]),
  ),
  { raw: 1, graded: [["s1", false, 0], ["s2", false, 0], ["s3", true, 1]] },
);
// no groups map at all (legacy caller) → row-wise
assert.deepEqual(
  gradeSet(new Map<string, unknown>([["s1", "kitchen"], ["s2", "garden"]]), null),
  { raw: 0, graded: [["s1", false, 0], ["s2", false, 0]] },
);
// a single-row any-order group is row-wise
assert.deepEqual(
  gradeSet(new Map<string, unknown>([["s1", "kitchen"]]), anyOrder, [saq("s1")]),
  { raw: 0, graded: [["s1", false, 0]] },
);
// select-mode set ("choose TWO letters, in either order", one row per number)
assert.deepEqual(
  gradeSet(
    new Map<string, unknown>([["s1", "d"], ["s2", "b"]]),
    anyOrder,
    [
      q({ id: "s1", hasOptionBank: true, groupKey: "g1" }),
      q({ id: "s2", hasOptionBank: true, groupKey: "g1" }),
    ],
    new Map([
      ["s1", key("b")],
      ["s2", key("d")],
    ]),
  ),
  { raw: 2, graded: [["s1", true, 1], ["s2", true, 1]] },
);
// a numberSpan mcq_multi row is untouched by the any-order pass
assert.deepEqual(
  gradeSet(
    new Map<string, unknown>([["m1", ["c", "a"]], ["s1", "garden"]]),
    anyOrder,
    [
      q({
        id: "m1",
        questionType: "mcq_multi",
        maxPoints: 2,
        family: "multi_select",
        hasOptionBank: true,
        selectCount: 2,
        numberSpan: 2,
        groupKey: "g1",
      }),
      saq("s1"),
    ],
    new Map([
      ["m1", key(["a", "c"])],
      ["s1", key("garden")],
    ]),
  ),
  { raw: 3, graded: [["m1", true, 2], ["s1", true, 1]] },
);

// ---- allowNumber reaches the text grader -----------------------------------
{
  const weeks = gradeObjectiveAttempt({
    questions: [
      saq("w1", { groupKey: null, allowNumber: true }),
      saq("w2", { groupKey: null, allowNumber: false }),
    ],
    keys: new Map([
      ["w1", key("3 weeks")],
      ["w2", key("3 weeks")],
    ]),
    responses: new Map<string, unknown>([["w1", "3 weeks"], ["w2", "3 weeks"]]),
    module: "academic",
    bandRows,
  });
  assert.deepEqual(
    weeks.graded.map((g) => [g.questionId, g.isCorrect, g.awardedPoints]),
    [["w1", true, 1], ["w2", false, 0]],
  );
}

console.log("scoring/ielts/grade-objective tests passed");
