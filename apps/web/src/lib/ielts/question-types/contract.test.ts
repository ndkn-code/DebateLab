/**
 * Contract tests for the IELTS objective question-type module (WS-1.2): registry
 * mapping, DB-row parsing, key parsing, answer helpers, and prompt segmentation.
 * Runs under tsx with no database.
 */
import assert from "node:assert/strict";
import {
  DEFAULT_BLANK_ID,
  getFixedOptions,
  getQuestionFamily,
  IeltsAnswerSchema,
  isObjectiveQuestionType,
  parsePromptSegments,
  parseQuestionView,
  parseRawAnswerKey,
  promptBlankIds,
  hasPromptBlanks,
  getArrayValue,
  getStringValue,
  setValue,
  toggleArrayValue,
} from "./index";
import type { Tables } from "@/types/supabase";

type QuestionRow = Tables<"ielts_questions">;

function row(overrides: Partial<QuestionRow>): QuestionRow {
  return {
    id: "q1",
    test_id: "t1",
    passage_id: null,
    listening_section_id: null,
    skill: "reading",
    question_type: "mcq_single",
    order_index: 0,
    group_key: null,
    group_instructions: null,
    prompt: "",
    options: [],
    max_points: 1,
    word_limit: null,
    visual: null,
    metadata: {},
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

// ── registry ─────────────────────────────────────────────────────────────────
assert.equal(getQuestionFamily("mcq_single"), "single_select");
assert.equal(getQuestionFamily("true_false_notgiven"), "single_select");
assert.equal(getQuestionFamily("mcq_multi"), "multi_select");
assert.equal(getQuestionFamily("matching_headings"), "matching");
assert.equal(getQuestionFamily("summary_completion"), "completion");
assert.equal(getQuestionFamily("map_plan_label"), "labeling");
assert.equal(getFixedOptions("true_false_notgiven").length, 3);
assert.equal(getFixedOptions("yes_no_notgiven")[2].id, "not_given");
assert.equal(getFixedOptions("mcq_single").length, 0);
assert.equal(isObjectiveQuestionType("mcq_single"), true);
assert.equal(isObjectiveQuestionType("writing_task2_essay"), false);
assert.equal(isObjectiveQuestionType("speaking_part1"), false);

// ── parseQuestionView: authored MCQ options ──────────────────────────────────
{
  const view = parseQuestionView(
    row({
      question_type: "mcq_single",
      prompt: "Pick one",
      options: [
        { id: "a", text: "Alpha" },
        { id: "b", text: "Beta" },
      ],
    }),
  );
  assert.equal(view.family, "single_select");
  assert.equal(view.options[0].label, "A"); // auto label
  assert.equal(view.options[1].id, "b");
}

// ── parseQuestionView: fixed T/F/NG options injected ─────────────────────────
{
  const view = parseQuestionView(row({ question_type: "true_false_notgiven", options: [] }));
  assert.deepEqual(view.options.map((o) => o.id), ["true", "false", "not_given"]);
}

// ── parseQuestionView: string-shorthand options ──────────────────────────────
{
  const view = parseQuestionView(row({ options: ["First", "Second"] }));
  assert.equal(view.options[0].id, "0");
  assert.equal(view.options[0].text, "First");
  assert.equal(view.options[1].label, "B");
}

// ── parseQuestionView: matching items from metadata ──────────────────────────
{
  const view = parseQuestionView(
    row({
      question_type: "matching_information",
      options: [{ id: "i", text: "Para A" }],
      metadata: { items: [{ id: "s1", label: "1", text: "Statement" }] },
    }),
  );
  assert.equal(view.items.length, 1);
  assert.equal(view.items[0].id, "s1");
}

// ── parseQuestionView: authored visuals normalize type → kind ────────────────
{
  const view = parseQuestionView(
    row({
      question_type: "note_table_form_flowchart_completion",
      word_limit: 2,
      metadata: { selectCount: 2 },
      visual: {
        type: "table",
        headers: ["Year", "Sales"],
        rows: [["2025", "42"]],
      },
    }),
  );
  assert.equal(view.wordLimit, 2);
  assert.equal(view.selectCount, 2);
  assert.equal(view.visual?.kind, "table");
  if (view.visual?.kind === "table") {
    assert.deepEqual(view.visual.headers, ["Year", "Sales"]);
    assert.equal(view.visual.rows[0]?.[1]?.text, "42");
  }
}

{
  const view = parseQuestionView(
    row({
      question_type: "diagram_label",
      visual: { type: "image", url: "https://example.com/d.png", alt: "A diagram" },
    }),
  );
  assert.equal(view.visual?.kind, "image");
  if (view.visual?.kind === "image") assert.deepEqual(view.visual.hotspots, []);
}

{
  const view = parseQuestionView(
    row({
      visual: {
        type: "chart",
        chartType: "line",
        title: "Annual sales",
        xAxisKey: "year",
        data: [{ year: "2025", sales: 42 }],
        series: [{ dataKey: "sales", label: "Sales" }],
      },
    }),
  );
  assert.equal(view.visual?.kind, "chart");
  if (view.visual?.kind === "chart") assert.equal(view.visual.series[0]?.label, "Sales");
}

{
  const view = parseQuestionView(
    row({ visual: { type: "described", description: "A line graph of annual sales." } }),
  );
  assert.deepEqual(view.visual, {
    kind: "described",
    description: "A line graph of annual sales.",
  });
}

// Null remains null, while the legacy objective shape stays supported.
{
  assert.equal(parseQuestionView(row({ visual: null })).visual, null);
  const view = parseQuestionView(
    row({ visual: { kind: "image", url: "/d.png", hotspots: [{ id: "h1", x: 10, y: 20 }] } }),
  );
  assert.equal(view.visual?.kind, "image");
  if (view.visual?.kind === "image") assert.equal(view.visual.hotspots[0]?.id, "h1");
}

// ── parseQuestionView: malformed visual degrades to null ─────────────────────
{
  const view = parseQuestionView(row({ visual: { kind: "bogus" } }));
  assert.equal(view.visual, null);
}

// ── parseRawAnswerKey: object, bare string, bare array, variants ─────────────
assert.deepEqual(parseRawAnswerKey({ "1": "x" }, {}).correctAnswer, { "1": "x" });
assert.deepEqual(parseRawAnswerKey("b", []).correctAnswer, { "0": "b" }); // bare → blank "0"
assert.deepEqual(parseRawAnswerKey(["a", "c"], []).correctAnswer, { "0": ["a", "c"] });
assert.deepEqual(
  parseRawAnswerKey({ "1": "x" }, { "1": ["y"] }).acceptVariants,
  { "1": ["y"] },
);
assert.deepEqual(parseRawAnswerKey({ "0": "x" }, ["y"]).acceptVariants, { "0": ["y"] });
assert.deepEqual(parseRawAnswerKey(42, 42).correctAnswer, {}); // garbage → empty

// ── answer helpers ───────────────────────────────────────────────────────────
assert.equal(getStringValue(null, "0"), "");
assert.equal(getStringValue({ values: { "0": "x" } }, "0"), "x");
assert.equal(getStringValue({ values: { "0": ["x"] } }, "0"), ""); // array → not a string
assert.deepEqual(getArrayValue({ values: { "0": ["x"] } }, "0"), ["x"]);
assert.deepEqual(getArrayValue(null, "0"), []);
assert.deepEqual(setValue(null, "0", "y").values, { "0": "y" });
{
  const a1 = toggleArrayValue(null, "m", "a");
  assert.deepEqual(getArrayValue(a1, "m"), ["a"]);
  const a2 = toggleArrayValue(a1, "m", "a"); // toggle off
  assert.deepEqual(getArrayValue(a2, "m"), []);
  const full = toggleArrayValue({ values: { m: ["a", "b"] } }, "m", "c", 2); // at max → ignored
  assert.deepEqual(getArrayValue(full, "m"), ["a", "b"]);
}
assert.equal(DEFAULT_BLANK_ID, "0");

// ── answer boundary schema (guards the grading server action) ────────────────
{
  const parsed = IeltsAnswerSchema.parse({ values: { "0": "b", m: ["a", "c"] } });
  assert.deepEqual(parsed.values["0"], "b");
  assert.deepEqual(parsed.values.m, ["a", "c"]);
  // missing `values` defaults to an empty record
  assert.deepEqual(IeltsAnswerSchema.parse({}).values, {});
  // non-string/array blank values are rejected
  assert.equal(IeltsAnswerSchema.safeParse({ values: { "0": 5 } }).success, false);
}

// ── prompt segmentation ──────────────────────────────────────────────────────
{
  const segs = parsePromptSegments("The __BLANK_1__ orbits the __BLANK_2__.");
  assert.equal(segs.length, 5);
  assert.equal(segs[0].type, "text");
  assert.equal(segs[1].type, "blank");
  assert.deepEqual(promptBlankIds("a __BLANK_x__ b __BLANK_y__"), ["x", "y"]);
  assert.equal(hasPromptBlanks("no blanks here"), false);
  assert.equal(hasPromptBlanks("has __BLANK_1__"), true);
}

console.log("IELTS question-type contract tests passed");
