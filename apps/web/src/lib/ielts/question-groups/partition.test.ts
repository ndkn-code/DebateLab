import assert from "node:assert/strict";
import {
  indexGroupsByKey,
  type IeltsQuestionGroupView,
} from "@/lib/ielts/question-types/groups";
import { assignQuestionNumbers } from "./numbering";
import {
  blockStartNumber,
  partitionPartQuestions,
  resolveBlockSlots,
  stimulusSlotCoverage,
} from "./partition";
import type { PartitionQuestionLike } from "./types";

function group(overrides: Partial<IeltsQuestionGroupView> = {}): IeltsQuestionGroupView {
  return {
    id: "g1",
    groupKey: "headings",
    skill: "reading",
    passageId: "p1",
    listeningSectionId: null,
    orderIndex: 0,
    title: null,
    instructions: null,
    stimulus: null,
    bank: [],
    bankReuse: false,
    answerMode: "select",
    anyOrder: false,
    questionIds: ["stale"],
    slotByQuestionId: { stale: "9" },
    ...overrides,
  };
}

const q = (
  id: string,
  groupKey: string | null,
  extra: Partial<PartitionQuestionLike> = {},
): PartitionQuestionLike => ({ id, groupKey, ...extra });

const groups = indexGroupsByKey([
  group(),
  group({ id: "g2", groupKey: "summary", stimulus: { kind: "text", body: "A __BLANK_1__ B __BLANK_2__ C __BLANK_3__" } }),
]);

// Consecutive grouping + orphan groupKey → singles + null key → single.
{
  const questions = [q("q1", "headings"), q("q2", "headings"), q("q3", "headings"), q("q4", "ghost"), q("q5", null)];
  const numbers = assignQuestionNumbers([{ questions }]);
  const blocks = partitionPartQuestions(questions, groups, numbers);
  assert.equal(blocks.length, 3);
  const [g, s1, s2] = blocks;
  assert.equal(g.kind, "group");
  if (g.kind !== "group") throw new Error("unreachable");
  assert.deepEqual(g.questions.map((x) => x.id), ["q1", "q2", "q3"]);
  assert.deepEqual(g.group.questionIds, ["q1", "q2", "q3"]); // recomputed, not "stale"
  assert.deepEqual(g.slotByQuestionId, { q1: "1", q2: "2", q3: "3" }); // default = position
  assert.deepEqual(g.group.slotByQuestionId, g.slotByQuestionId);
  assert.equal(g.rangeLabel, "Questions 1–3");
  assert.deepEqual(g.numbers.map((n) => n.label), ["1", "2", "3"]);
  assert.equal(s1.kind, "single");
  assert.equal(s2.kind, "single");
  if (s1.kind !== "single" || s2.kind !== "single") throw new Error("unreachable");
  assert.equal(s1.number.label, "4");
  assert.equal(s2.number.label, "5");
  assert.equal(blockStartNumber(g), 1);
  assert.equal(blockStartNumber(s2), 5);
}

// Interleaving breaks a block into two group blocks around the foreign question.
{
  const questions = [q("a", "headings"), q("b", "headings"), q("x", null), q("c", "headings")];
  const blocks = partitionPartQuestions(questions, groups, assignQuestionNumbers([{ questions }]));
  assert.deepEqual(blocks.map((b) => b.kind), ["group", "single", "group"]);
  const last = blocks[2];
  if (last.kind !== "group") throw new Error("unreachable");
  assert.deepEqual(last.questions.map((x) => x.id), ["c"]);
  assert.equal(last.rangeLabel, "Question 4");
}

// Two different groups back-to-back stay separate.
{
  const questions = [q("a", "headings"), q("b", "summary")];
  const blocks = partitionPartQuestions(questions, groups, assignQuestionNumbers([{ questions }]));
  assert.deepEqual(blocks.map((b) => b.kind), ["group", "group"]);
}

// Explicit slot (field or metadata) wins; numberSpan flows into the range label.
{
  const questions = [
    q("a", "summary", { slot: "3" }),
    q("b", "summary", { metadata: { slot: "1" } }),
    q("c", "summary"),
  ];
  assert.deepEqual(resolveBlockSlots(questions), { a: "3", b: "1", c: "3" });
  const numbers = assignQuestionNumbers([{ questions: [{ id: "a", numberSpan: 2 }, { id: "b" }, { id: "c" }] }], 21);
  const [block] = partitionPartQuestions(questions, groups, numbers);
  if (block.kind !== "group") throw new Error("unreachable");
  assert.equal(block.rangeLabel, "Questions 21–24");
  assert.equal(block.numbers[0].label, "21–22");
}

// Coverage: missing stimulus slots and extra member slots; null stimulus → empty.
{
  const questions = [q("a", "summary", { slot: "1" }), q("b", "summary", { slot: "7" })];
  const [block] = partitionPartQuestions(questions, groups, assignQuestionNumbers([{ questions }]));
  if (block.kind !== "group") throw new Error("unreachable");
  assert.deepEqual(stimulusSlotCoverage(block), { missing: ["2", "3"], extra: ["7"] });

  const bankOnly = [q("h1", "headings")];
  const [hb] = partitionPartQuestions(bankOnly, groups, assignQuestionNumbers([{ questions: bankOnly }]));
  if (hb.kind !== "group") throw new Error("unreachable");
  assert.deepEqual(stimulusSlotCoverage(hb), { missing: [], extra: [] });
}

// Missing number map entry falls back to 1-based position within the part.
{
  const questions = [q("z", null)];
  const [single] = partitionPartQuestions(questions, groups, new Map());
  if (single.kind !== "single") throw new Error("unreachable");
  assert.equal(single.number.label, "1");
}

console.log("partition.test.ts ok");
