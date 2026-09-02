import assert from "node:assert/strict";
import type { IeltsQuestionGroupView } from "@/lib/ielts/question-types";
import {
  bankOptionFullLabel,
  bankOptionLabel,
  blockNumberRange,
  buildSlotRefs,
  canPlaceOption,
  groupSelectCount,
  indexSlotRefs,
  isSelectGroup,
  resolveGroupLayout,
  slotVerdictState,
} from "./group-answers";

const bank = [
  { id: "a", label: "A", text: "Alpha" },
  { id: "b", label: "B", text: "Beta" },
];

function group(
  overrides: Partial<IeltsQuestionGroupView> = {},
): Pick<IeltsQuestionGroupView, "stimulus" | "bank" | "answerMode" | "bankReuse"> {
  return { stimulus: null, bank, answerMode: "select", bankReuse: false, ...overrides };
}

const q = (id: string, family = "completion", selectCount: number | null = null) => ({
  id,
  family,
  prompt: `Prompt ${id}`,
  wordLimit: 2,
  selectCount,
});
const n = (id: string, start: number, end = start) => ({
  questionId: id,
  start,
  end,
  label: end > start ? `${start}–${end}` : String(start),
});

// ── layout dispatch ──────────────────────────────────────────────────────────
assert.equal(
  resolveGroupLayout({
    group: group(),
    questions: [q("1"), q("2")],
    numbers: [n("1", 1), n("2", 2)],
    slotByQuestionId: { "1": "1", "2": "2" },
  }),
  "matching",
  "bank-only group with no stimulus is a matching list",
);
assert.equal(
  resolveGroupLayout({
    group: group({ stimulus: { kind: "text", body: "x __BLANK_1__" } }),
    questions: [q("1")],
    numbers: [n("1", 1)],
    slotByQuestionId: { "1": "1" },
  }),
  "text",
);
assert.equal(
  resolveGroupLayout({
    group: group({ stimulus: { kind: "table", headers: [], rows: [] } }),
    questions: [q("1")],
    numbers: [n("1", 1)],
    slotByQuestionId: { "1": "1" },
  }),
  "table",
);
assert.equal(
  resolveGroupLayout({
    group: group({
      stimulus: { kind: "flowchart", direction: "down", steps: [{ text: "s" }] },
    }),
    questions: [q("1")],
    numbers: [n("1", 1)],
    slotByQuestionId: { "1": "1" },
  }),
  "flowchart",
);
assert.equal(
  resolveGroupLayout({
    group: group({
      stimulus: { kind: "image", url: "https://x.test/a.png", alt: "a", hotspots: [] },
    }),
    questions: [q("1")],
    numbers: [n("1", 1)],
    slotByQuestionId: { "1": "1" },
  }),
  "image",
);
assert.equal(
  resolveGroupLayout({
    group: group({ stimulus: { kind: "text", body: "ignored" } }),
    questions: [q("m", "multi_select", 2)],
    numbers: [n("m", 21, 22)],
    slotByQuestionId: { m: "1" },
  }),
  "multi_select",
  "an all-mcq_multi run wins over the stimulus kind",
);

// ── select vs text ───────────────────────────────────────────────────────────
assert.equal(isSelectGroup(group()), true);
assert.equal(isSelectGroup(group({ answerMode: "text" })), false);
assert.equal(isSelectGroup(group({ bank: [] })), false, "select needs a bank");

// ── slot refs ────────────────────────────────────────────────────────────────
const refs = buildSlotRefs({
  group: group(),
  questions: [q("x"), q("y")],
  numbers: [n("x", 5), n("y", 6)],
  slotByQuestionId: { x: "b1", y: "b2" },
});
assert.deepEqual(
  refs.map((r) => [r.questionId, r.slot, r.number.label]),
  [
    ["x", "b1", "5"],
    ["y", "b2", "6"],
  ],
);
const index = indexSlotRefs([...refs, { ...refs[0], questionId: "dup" }]);
assert.equal(index.get("b1")?.questionId, "x", "first owner of a slot wins");
assert.equal(index.size, 2);

// ── bank labels ──────────────────────────────────────────────────────────────
assert.equal(bankOptionLabel(bank, "b"), "B");
assert.equal(bankOptionLabel(bank, "zzz"), "zzz", "unknown id falls back to the id");
assert.equal(bankOptionLabel(bank, null), "");
assert.equal(bankOptionFullLabel(bank[0]), "A. Alpha");
assert.equal(bankOptionFullLabel({ id: "t", text: "Only text" }), "Only text");

// ── verdict state ────────────────────────────────────────────────────────────
const verdicts = {
  x: { awardedPoints: 1, maxPoints: 1, isCorrect: true, blanks: { "0": { awarded: 1, max: 1, correct: true } } },
  y: { awardedPoints: 0, maxPoints: 1, isCorrect: false, blanks: { "0": { awarded: 0, max: 1, correct: false } } },
};
assert.equal(slotVerdictState(verdicts, "x"), "correct");
assert.equal(slotVerdictState(verdicts, "y"), "incorrect");
assert.equal(slotVerdictState(verdicts, "z"), "idle");
assert.equal(slotVerdictState(undefined, "x"), "idle");

// ── placement rules ──────────────────────────────────────────────────────────
const responses = { x: { values: { "0": "a" } } };
const used = new Set(["a"]);
assert.equal(canPlaceOption(group(), responses, used, "y", "a"), false, "used option blocked");
assert.equal(canPlaceOption(group(), responses, used, "x", "a"), true, "own value re-placeable");
assert.equal(canPlaceOption(group(), responses, used, "y", "b"), true);
assert.equal(
  canPlaceOption(group({ bankReuse: true }), responses, used, "y", "a"),
  true,
  "bankReuse allows repeats",
);

// ── multi-select count + range ───────────────────────────────────────────────
assert.equal(
  groupSelectCount({
    group: group(),
    questions: [q("m", "multi_select", 2)],
    numbers: [n("m", 21, 22)],
    slotByQuestionId: { m: "1" },
  }),
  2,
);
assert.deepEqual(blockNumberRange({ numbers: [n("a", 3), n("b", 4, 5)] }), { first: 3, last: 5 });

console.log("IELTS group-answers helper tests passed");
