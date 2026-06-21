import assert from "node:assert/strict";
import {
  IELTS_QUESTION_TYPES,
  IELTS_SPEAKING_QUESTION_TYPES,
  IELTS_WRITING_QUESTION_TYPES,
} from "@/lib/api/ielts/schema";
import { OBJECTIVE_QUESTION_TYPES } from "@/lib/ielts/question-types";
import {
  getRegisteredIeltsQuestionRendererTypes,
  isIeltsQuestionRendererRegistered,
} from "../question-renderer-registry";
import { ensureIeltsTaskRenderersRegistered } from "./register-task-renderers";

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

console.log("IELTS renderer registry coverage tests passed");
