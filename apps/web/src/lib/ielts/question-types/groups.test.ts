import assert from "node:assert/strict";
import {
  GroupStimulusSchema,
  indexGroupsByKey,
  normalizeGroupBank,
  normalizeGroupStimulus,
  parseQuestionGroupView,
  resolveGroupSlots,
  stimulusSlots,
  type IeltsQuestionGroupRowLike,
} from "./groups";

function groupRow(overrides: Partial<IeltsQuestionGroupRowLike> = {}): IeltsQuestionGroupRowLike {
  return {
    id: "g1",
    group_key: "r1-headings",
    skill: "reading",
    passage_id: "p1",
    listening_section_id: null,
    order_index: 0,
    title: "Questions 1–3",
    instructions: "Choose the correct heading.",
    stimulus: null,
    bank: ["Heading one", "Heading two", { id: "iii", label: "iii", text: "Heading three" }],
    bank_reuse: false,
    answer_mode: null,
    any_order: false,
    ...overrides,
  };
}

// Bank shorthand → labelled options; explicit objects keep their ids.
{
  const bank = normalizeGroupBank(groupRow().bank);
  assert.equal(bank.length, 3);
  assert.deepEqual(bank[0], { id: "0", label: "A", text: "Heading one" });
  assert.equal(bank[2].id, "iii");
  assert.equal(bank[2].label, "iii");
  assert.deepEqual(normalizeGroupBank("not a list"), []);
}

// Slots default to 1-based position; explicit metadata.slot wins.
{
  const slots = resolveGroupSlots([
    { id: "q1", metadata: {} },
    { id: "q2", metadata: { slot: "7" } },
    { id: "q3", metadata: null },
  ]);
  assert.deepEqual(slots, { q1: "1", q2: "7", q3: "3" });
}

// Group view: answerMode falls back to select when a bank exists.
{
  const view = parseQuestionGroupView(groupRow(), [
    { id: "q1", metadata: {} },
    { id: "q2", metadata: {} },
  ]);
  assert.equal(view.groupKey, "r1-headings");
  assert.equal(view.answerMode, "select");
  assert.deepEqual(view.questionIds, ["q1", "q2"]);
  assert.equal(view.slotByQuestionId.q2, "2");
  assert.equal(view.stimulus, null);
  assert.equal(indexGroupsByKey([view]).get("r1-headings"), view);
}

// Text stimulus: slots follow the blank markers in document order.
{
  const stimulus = normalizeGroupStimulus({
    kind: "text",
    body: "Dunes need __BLANK_11__ and __BLANK_12__ to grow.",
  });
  assert.equal(stimulus?.kind, "text");
  assert.deepEqual(stimulusSlots(stimulus), ["11", "12"]);
}

// Table stimulus: gap cells become IeltsTableCell gaps.
{
  const stimulus = normalizeGroupStimulus({
    kind: "table",
    headers: ["Item", "Price"],
    rows: [["Apron", { gap: "6" }], [{ gap: "7", label: "7" }, "£3"]],
  });
  assert.equal(stimulus?.kind, "table");
  if (stimulus?.kind === "table") {
    assert.deepEqual(stimulus.rows[0][0], { text: "Apron" });
    assert.deepEqual(stimulus.rows[0][1], { gap: { id: "6", label: undefined } });
    assert.deepEqual(stimulusSlots(stimulus), ["6", "7"]);
  }
}

// Flowchart stimulus.
{
  const stimulus = normalizeGroupStimulus({
    kind: "flowchart",
    steps: [{ text: "Apply __BLANK_31__" }, { text: "Wait" }, { text: "Add __BLANK_32__ coats" }],
  });
  assert.equal(stimulus?.kind, "flowchart");
  if (stimulus?.kind === "flowchart") assert.equal(stimulus.direction, "down");
  assert.deepEqual(stimulusSlots(stimulus), ["31", "32"]);
}

// Image stimulus: hotspot `slot` (or legacy `id`) becomes the hotspot id.
{
  const stimulus = normalizeGroupStimulus({
    kind: "image",
    url: "https://example.test/map.svg",
    alt: "Sports park map",
    hotspots: [
      { slot: "11", x: 12, y: 18 },
      { id: "12", x: 35, y: 15, label: "12" },
    ],
  });
  assert.equal(stimulus?.kind, "image");
  if (stimulus?.kind === "image") {
    assert.deepEqual(stimulus.hotspots[0], { id: "11", label: undefined, x: 12, y: 18 });
    assert.equal(stimulus.hotspots[1].id, "12");
  }
  assert.deepEqual(stimulusSlots(stimulus), ["11", "12"]);
}

// Malformed stimulus degrades to null; the strict schema rejects it.
assert.equal(normalizeGroupStimulus({ kind: "image", url: "not-a-url", alt: "x" }), null);
assert.equal(normalizeGroupStimulus({ kind: "sculpture" }), null);
assert.equal(GroupStimulusSchema.safeParse({ kind: "text", body: "" }).success, false);
assert.equal(
  GroupStimulusSchema.safeParse({ kind: "image", url: "https://x.test/a.png", alt: "a", hotspots: [{ x: 1, y: 2 }] })
    .success,
  false,
);

console.log("groups.test: ok");
