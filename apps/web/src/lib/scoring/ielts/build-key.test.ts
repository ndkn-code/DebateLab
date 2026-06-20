import assert from "node:assert/strict";
import { buildAnswerKey, modeForFamily } from "./build-key";

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

console.log("scoring/ielts/build-key tests passed");
