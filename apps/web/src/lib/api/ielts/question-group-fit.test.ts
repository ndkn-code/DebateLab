/**
 * Unit tests for the pure question ↔ group fit check. Run under tsx.
 */
import assert from "node:assert/strict";
import { parseInput } from "@/lib/api/boundary";
import { CreateIeltsQuestionSchema, type NormalizedQuestionInput } from "./question-schema";
import { acceptSetOf, assertQuestionFitsGroup, type QuestionGroupRow } from "./question-group-fit";

const TID = "11111111-1111-4111-8111-111111111111";

function group(over: Partial<QuestionGroupRow> = {}): QuestionGroupRow {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    test_id: TID,
    skill: "reading",
    passage_id: null,
    listening_section_id: null,
    group_key: "set-1",
    order_index: 0,
    title: null,
    instructions: null,
    stimulus: null,
    bank: [],
    bank_reuse: false,
    answer_mode: null,
    any_order: false,
    metadata: {},
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  };
}

function question(over: Record<string, unknown>): NormalizedQuestionInput {
  return parseInput(CreateIeltsQuestionSchema, {
    testId: TID,
    skill: "reading",
    groupKey: "set-1",
    orderIndex: 10,
    ...over,
  });
}

// acceptSetOf flattens strings, lists and per-blank records; normalized
assert.deepEqual([...acceptSetOf("Trophic Cascade.")], ["trophic cascade"]);
assert.deepEqual([...acceptSetOf(["B", "d"])].sort(), ["b", "d"]);
assert.deepEqual([...acceptSetOf({ "1": "rivers", "2": ["Forests", "woods"] })].sort(), ["forests", "rivers", "woods"]);

// skill mismatch
assert.throws(
  () =>
    assertQuestionFitsGroup(
      question({ skill: "listening", questionType: "short_answer", prompt: "P", correctAnswer: "x" }),
      group(),
      [],
    ),
  /group skill is reading/,
);

// slot: explicit metadata.slot wins; default is the 1-based display position
{
  const q = question({ questionType: "short_answer", prompt: "P", correctAnswer: "x" });
  const siblings = [
    { metadata: {}, correctAnswer: "a", orderIndex: 1 },
    { metadata: {}, correctAnswer: "b", orderIndex: 2 },
  ];
  assert.deepEqual(assertQuestionFitsGroup(q, group(), siblings), { slot: "3" });
  const explicit = question({ questionType: "short_answer", prompt: "P", correctAnswer: "x", metadata: { slot: "9" } });
  assert.deepEqual(assertQuestionFitsGroup(explicit, group(), siblings), { slot: "9" });
}
// slot collision with a sibling is rejected
assert.throws(
  () =>
    assertQuestionFitsGroup(
      question({ questionType: "short_answer", prompt: "P", correctAnswer: "x", metadata: { slot: "2" } }),
      group(),
      [{ metadata: { slot: "2" }, correctAnswer: "a", orderIndex: 1 }],
    ),
  /slot "2" is already used/,
);

// matching: group bank OR question items
{
  const q = question({ questionType: "matching_headings", prompt: "Paragraph A", correctAnswer: "ii" });
  assert.throws(() => assertQuestionFitsGroup(q, group(), []), /non-empty group bank/);
  assert.ok(assertQuestionFitsGroup(q, group({ bank: ["Heading i", "Heading ii"] }), []));
  const withItems = question({
    questionType: "matching_features",
    prompt: "Match",
    correctAnswer: { a: "1" },
    metadata: { items: [{ id: "a", text: "Statement" }] },
  });
  assert.ok(assertQuestionFitsGroup(withItems, group(), []));
}

// labeling: image stimulus with a hotspot for this slot
{
  const q = question({ questionType: "diagram_label", prompt: "Part", correctAnswer: "valve", metadata: { slot: "2" } });
  assert.throws(() => assertQuestionFitsGroup(q, group(), []), /image stimulus/);
  const textGroup = group({ stimulus: { kind: "text", body: "A __BLANK_2__" } });
  assert.throws(() => assertQuestionFitsGroup(q, textGroup, []), /image stimulus/);
  const noHotspot = group({
    stimulus: { kind: "image", url: "https://x.test/d.png", alt: "Diagram", hotspots: [{ slot: "1", x: 10, y: 10 }] },
  });
  assert.throws(() => assertQuestionFitsGroup(q, noHotspot, []), /no hotspot for slot "2"/);
  const ok = group({
    stimulus: {
      kind: "image",
      url: "https://x.test/d.png",
      alt: "Diagram",
      hotspots: [{ slot: "1", x: 10, y: 10 }, { id: "2", x: 50, y: 50 }],
    },
  });
  assert.deepEqual(assertQuestionFitsGroup(q, ok, []), { slot: "2" });
}

// any_order: identical accept sets across members
{
  const anyOrder = group({ any_order: true, skill: "listening" });
  const q = question({
    skill: "listening",
    questionType: "mcq_multi",
    prompt: "Which TWO",
    options: "A|B|C|D",
    correctAnswer: "B|D",
  });
  assert.ok(assertQuestionFitsGroup(q, anyOrder, [{ metadata: {}, correctAnswer: ["d", "B"], orderIndex: 1 }]));
  assert.throws(
    () => assertQuestionFitsGroup(q, anyOrder, [{ metadata: {}, correctAnswer: ["A", "B"], orderIndex: 1 }]),
    /any_order groups need every member key/,
  );
}

console.log("IELTS question-group-fit tests passed");
