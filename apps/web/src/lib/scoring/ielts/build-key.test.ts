import assert from "node:assert/strict";
import { buildAnswerKey, expandKeyAlternatives, modeForFamily } from "./build-key";

// ── modeForFamily (every family + the option-bank branch) ────────────────────
assert.equal(modeForFamily("single_select", false), "select");
assert.equal(modeForFamily("matching", false), "select");
assert.equal(modeForFamily("multi_select", false), "multi_select");
assert.equal(modeForFamily("completion", false), "text");
assert.equal(modeForFamily("completion", true), "select"); // word-bank completion
assert.equal(modeForFamily("labeling", false), "text");
assert.equal(modeForFamily("labeling", true), "select"); // label from a bank

// ── single_select: one option id ─────────────────────────────────────────────
{
  const key = buildAnswerKey(
    { correctAnswer: { "0": "b" }, acceptVariants: {} },
    { family: "single_select", hasOptionBank: true },
  );
  assert.deepEqual(key.blanks["0"], { mode: "select", accept: ["b"] });
}

// ── matching: several blanks, each one option id ─────────────────────────────
{
  const key = buildAnswerKey(
    { correctAnswer: { item1: "iii", item2: "v" }, acceptVariants: {} },
    { family: "matching", hasOptionBank: true },
  );
  assert.deepEqual(key.blanks.item1, { mode: "select", accept: ["iii"] });
  assert.deepEqual(key.blanks.item2, { mode: "select", accept: ["v"] });
}

// ── multi_select: correct set sizes the `select` count ───────────────────────
{
  const key = buildAnswerKey(
    { correctAnswer: { "0": ["a", "c"] }, acceptVariants: {} },
    { family: "multi_select", hasOptionBank: true },
  );
  assert.deepEqual(key.blanks["0"], {
    mode: "multi_select",
    accept: ["a", "c"],
    select: 2,
  });
}

// ── multi_select: explicit selectCount overrides the default ─────────────────
{
  const key = buildAnswerKey(
    { correctAnswer: { "0": ["a", "b", "c"] }, acceptVariants: {} },
    { family: "multi_select", hasOptionBank: true, selectCount: 2 },
  );
  assert.equal(key.blanks["0"].select, 2);
}

// ── text: canonical + variants merged and de-duplicated ──────────────────────
{
  const key = buildAnswerKey(
    {
      correctAnswer: { "1": "colour" },
      acceptVariants: { "1": ["color", "colour"] },
    },
    { family: "completion", hasOptionBank: false },
  );
  assert.deepEqual(key.blanks["1"], {
    mode: "text",
    accept: ["colour", "color"], // dedup keeps first occurrence
  });
}

// ── tolerant of an array correct value in a select family ────────────────────
{
  const key = buildAnswerKey(
    { correctAnswer: { "0": ["a", "", "b"] }, acceptVariants: {} },
    { family: "single_select", hasOptionBank: true },
  );
  assert.deepEqual(key.blanks["0"].accept, ["a", "b"]); // empties filtered
}

// ── expandKeyAlternatives ────────────────────────────────────────────────────
assert.deepEqual(expandKeyAlternatives("garden"), ["garden"]);
assert.deepEqual(expandKeyAlternatives("1/2"), ["1/2"]); // fraction: no letters, not split
assert.deepEqual(expandKeyAlternatives("12/05"), ["12/05"]); // date stays intact
assert.deepEqual(expandKeyAlternatives("roof-top/rooftop"), [
  "roof-top/rooftop", // original always kept first
  "roof-top",
  "rooftop",
]); // expands to 2 alternatives
assert.deepEqual(expandKeyAlternatives("(the) garden"), [
  "(the) garden",
  "the garden",
  "garden",
]);
assert.deepEqual(expandKeyAlternatives("2/two"), ["2/two", "2", "two"]); // one side has a letter
assert.deepEqual(expandKeyAlternatives("(the) roof-top/rooftop"), [
  "(the) roof-top/rooftop",
  "the roof-top",
  "rooftop",
  "roof-top",
]);
assert.deepEqual(expandKeyAlternatives("colour (pencil)"), [
  "colour (pencil)",
  "colour pencil",
  "colour",
]);
assert.deepEqual(expandKeyAlternatives("  "), []);

// ── text: authored alternatives are expanded into the accept set ─────────────
{
  const key = buildAnswerKey(
    {
      correctAnswer: { "0": "roof-top/rooftop" },
      acceptVariants: { "0": ["(the) roof", "rooftop"] },
    },
    { family: "completion", hasOptionBank: false },
  );
  assert.deepEqual(key.blanks["0"], {
    mode: "text",
    accept: ["roof-top/rooftop", "roof-top", "rooftop", "(the) roof", "the roof", "roof"],
  });
}

// ── select: option ids are never expanded ("1/2" style ids stay verbatim) ────
{
  const key = buildAnswerKey(
    { correctAnswer: { "0": "a/b" }, acceptVariants: {} },
    { family: "single_select", hasOptionBank: true },
  );
  assert.deepEqual(key.blanks["0"], { mode: "select", accept: ["a/b"] });
}

// verdict tokens authored as display text fold onto option ids
{
  const key = buildAnswerKey(
    { correctAnswer: { "0": "NOT GIVEN" }, acceptVariants: {} },
    { family: "single_select", hasOptionBank: true },
  );
  assert.deepEqual(key.blanks["0"].accept, ["not_given"]);
  assert.deepEqual(
    buildAnswerKey({ correctAnswer: { "0": "TRUE" }, acceptVariants: {} }, { family: "single_select", hasOptionBank: true }).blanks["0"].accept,
    ["true"],
  );
  assert.deepEqual(
    buildAnswerKey({ correctAnswer: { "0": "B" }, acceptVariants: {} }, { family: "matching", hasOptionBank: true }).blanks["0"].accept,
    ["B"],
  );
}

console.log("scoring/ielts/build-key tests passed");
