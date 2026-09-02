import assert from "node:assert/strict";
import type { ComponentType, ReactElement } from "react";
import {
  IELTS_QUESTION_TYPES,
  IELTS_SPEAKING_QUESTION_TYPES,
  IELTS_WRITING_QUESTION_TYPES,
} from "@/lib/api/ielts/schema";
import type { IeltsQuestionView } from "@/lib/ielts/question-contract";
import { OBJECTIVE_QUESTION_TYPES } from "@/lib/ielts/question-types";
import {
  adaptObjectiveRenderer,
  coerceObjectiveAnswer,
  getRegisteredIeltsQuestionRendererTypes,
  isIeltsQuestionRendererRegistered,
  type IeltsRendererContext,
} from "../question-renderer-registry";
import { ensureIeltsTaskRenderersRegistered } from "./register-task-renderers";
import type { IeltsRendererProps as ObjectiveRendererProps } from "./types";

ensureIeltsTaskRenderersRegistered();

const expected = new Set<string>([
  ...OBJECTIVE_QUESTION_TYPES,
  ...IELTS_WRITING_QUESTION_TYPES,
  ...IELTS_SPEAKING_QUESTION_TYPES,
]);

for (const type of IELTS_QUESTION_TYPES) {
  assert.equal(
    isIeltsQuestionRendererRegistered(type),
    true,
    `missing IELTS question renderer registration for ${type}`,
  );
}

assert.deepEqual(
  new Set(getRegisteredIeltsQuestionRendererTypes()),
  expected,
  "registered renderer set should match the full IELTS question-type taxonomy",
);

// ── adapter forwards player context + verdict to the family renderer ─────────
const question: IeltsQuestionView = {
  id: "q1",
  questionType: "mcq_single",
  family: "single_select",
  skill: "reading",
  prompt: "Pick one",
  groupInstructions: null,
  wordLimit: null,
  maxPoints: 1,
  options: [{ id: "a", label: "A", text: "Alpha" }],
  items: [],
  visual: null,
  selectCount: null,
  slot: null,
  numberSpan: null,
  allowNumber: null,
  cueCard: null,
  letter: null,
  orderIndex: 0,
  groupKey: null,
  passageId: null,
  listeningSectionId: null,
};
const context: IeltsRendererContext = { attemptId: "attempt-1", assessmentMode: "practice" };
const verdict = {
  awardedPoints: 1,
  maxPoints: 1,
  isCorrect: true,
  blanks: { "0": { awarded: 1, max: 1, correct: true } },
};
const Stub: ComponentType<ObjectiveRendererProps> = () => null;
const adapted = adaptObjectiveRenderer(Stub);
const element = adapted({
  question,
  value: { value: "a" },
  disabled: false,
  onChange: () => {},
  context,
  verdict,
}) as ReactElement<ObjectiveRendererProps> | null;

assert.ok(element, "adapter should return an element");
assert.equal(element.type, Stub, "adapter renders the wrapped family renderer");
assert.equal(element.props.context, context, "adapter forwards `context`");
assert.equal(element.props.verdict, verdict, "adapter forwards `verdict`");
assert.deepEqual(
  element.props.value,
  { values: { "0": "a" } },
  "legacy `{ value }` envelope is coerced onto blank 0",
);

// ── answer coercion ──────────────────────────────────────────────────────────
assert.deepEqual(coerceObjectiveAnswer(question, { values: { "0": "b" } }), {
  values: { "0": "b" },
});
assert.deepEqual(
  coerceObjectiveAnswer({ questionType: "mcq_multi" }, { values: ["a", "b"] }),
  { values: { "0": ["a", "b"] } },
);
assert.equal(coerceObjectiveAnswer(question, null), null);

console.log("IELTS renderer registry coverage tests passed");
