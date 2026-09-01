import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseInput } from "@/lib/api/boundary";
import {
  SaveResponseSchema,
  SectionActionSchema,
  StartMockAttemptSchema,
} from "./mock-schema";

const migration = readFileSync(
  resolve(
    process.cwd(),
    "../../supabase/migrations/20260829180000_ielts_attempt_security.sql",
  ),
  "utf8",
);

assert.match(
  migration,
  /create table if not exists public\.ielts_attempt_question_blueprints/,
);
assert.match(migration, /prevent_ielts_attempt_blueprint_mutation/);
assert.match(migration, /ATTEMPT_SECTION_MISMATCH/);
assert.match(migration, /QUESTION_NOT_IN_FROZEN_ATTEMPT/);
assert.match(migration, /public\.ielts_finalize_attempt\(p_attempt_id uuid\)/);
assert.match(migration, /ATTEMPT_INCOMPLETE/);
assert.match(migration, /public\.ielts_record_question_response_v2\(/);
assert.match(migration, /public\.ielts_create_attempt_with_blueprint\(/);
assert.match(migration, /SIMULATION_REQUIRES_LISTENING_READING_WRITING/);
assert.match(migration, /blueprint_frozen_at = now\(\)/);

const attemptId = "11111111-1111-4111-8111-111111111111";
const sectionId = "22222222-2222-4222-8222-222222222222";
const questionId = "33333333-3333-4333-8333-333333333333";
const deterministicTestId = "a18c3db6-d90b-5a53-e37e-4b8f0a1b5202";
const deterministicQuestionId = "f9fadc68-2b59-150e-759b-e866be5f38e5";

assert.equal(
  parseInput(SectionActionSchema, { attemptId, sectionId }).attemptId,
  attemptId,
);
assert.equal(
  parseInput(SaveResponseSchema, {
    attemptId,
    sectionId,
    questionId,
    response: "A",
  }).attemptId,
  attemptId,
);
assert.equal(
  parseInput(StartMockAttemptSchema, { testId: deterministicTestId }).testId,
  deterministicTestId,
);
assert.equal(
  parseInput(SaveResponseSchema, {
    attemptId,
    sectionId,
    questionId: deterministicQuestionId,
    response: "A deterministic mock answer",
  }).questionId,
  deterministicQuestionId,
);
assert.throws(() =>
  parseInput(StartMockAttemptSchema, { testId: "not-a-database-id" }),
);
assert.throws(() =>
  parseInput(SaveResponseSchema, {
    sectionId,
    questionId,
    response: "A",
  }),
);

console.log("IELTS attempt security contract tests passed");
