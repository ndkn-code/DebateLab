/**
 * Smoke test for the IELTS data-model boundary (WS-0.3) — the typed read/write
 * proof at the validation layer. Runs under tsx with no database: it exercises
 * the canonical create-path's Zod validation and the typed insert mapper.
 * (Compile-time, `toIeltsTestInsert` is checked against TablesInsert<"ielts_tests">.)
 */
import assert from "node:assert/strict";
import { parseInput } from "@/lib/api/boundary";
import {
  CreateIeltsTestSchema,
  CreateWritingResponseSchema,
  IELTS_QUESTION_TYPE_COUNT,
  countEssayWords,
  toIeltsTestInsert,
  toWritingResponseInsert,
  writingTaskNumberForQuestionType,
} from "./schema";

// valid full_mock input → parses, applies defaults, maps to a typed insert row
{
  const input = parseInput(CreateIeltsTestSchema, {
    slug: "academic-mock-1",
    title: "Academic Mock 1",
  });
  const row = toIeltsTestInsert(input);
  assert.equal(row.slug, "academic-mock-1");
  assert.equal(row.kind, "full_mock"); // default
  assert.equal(row.module, "academic"); // default
  assert.equal(row.status, "draft"); // default
  assert.equal(row.skill, null);
  assert.equal(row.time_limit_seconds, null);
}

// skill_set may carry a skill, and it round-trips into the insert row
{
  const input = parseInput(CreateIeltsTestSchema, {
    slug: "listening-drill",
    title: "Listening Drill",
    kind: "skill_set",
    skill: "listening",
    timeLimitSeconds: 1800,
  });
  const row = toIeltsTestInsert(input);
  assert.equal(row.kind, "skill_set");
  assert.equal(row.skill, "listening");
  assert.equal(row.time_limit_seconds, 1800);
}

// invalid: a full_mock must not set a skill (mirrors the DB CHECK)
assert.throws(() =>
  parseInput(CreateIeltsTestSchema, {
    slug: "bad-mock",
    title: "Bad",
    kind: "full_mock",
    skill: "reading",
  }),
);

// invalid: slug must be kebab-case
assert.throws(() =>
  parseInput(CreateIeltsTestSchema, { slug: "Not A Slug!", title: "X" }),
);

// invalid: unknown enum value is rejected
assert.throws(() =>
  parseInput(CreateIeltsTestSchema, { slug: "x", title: "X", kind: "bogus" }),
);

// the question-type taxonomy has all 19 IELTS types
assert.equal(IELTS_QUESTION_TYPE_COUNT, 19);

// --- WS-3.1 writing-response submission boundary -----------------------------
// word counting is whitespace-token based
assert.equal(countEssayWords("  one   two\tthree\nfour  "), 4);
assert.equal(countEssayWords(""), 0);

// task number derives from the question type (Task 2 counts double)
assert.equal(writingTaskNumberForQuestionType("writing_task2_essay"), 2);
assert.equal(writingTaskNumberForQuestionType("writing_task1_academic"), 1);
assert.equal(writingTaskNumberForQuestionType("writing_task1_general"), 1);

// valid submission parses + maps to a typed, pending insert with words counted
{
  const input = parseInput(CreateWritingResponseSchema, {
    attemptId: "11111111-1111-4111-8111-111111111111",
    questionId: "22222222-2222-4222-8222-222222222222",
    essay: "This is my essay answer.",
  });
  assert.equal(input.feedbackLanguage, "en"); // default
  const row = toWritingResponseInsert({ input, userId: "u-1", taskNumber: 2 });
  assert.equal(row.status, "pending");
  assert.equal(row.task_number, 2);
  assert.equal(row.word_count, 5);
  assert.equal(row.task_band, null);
  assert.equal(row.user_id, "u-1");
}

// invalid: non-uuid attempt id is rejected
assert.throws(() =>
  parseInput(CreateWritingResponseSchema, {
    attemptId: "nope",
    questionId: "22222222-2222-4222-8222-222222222222",
    essay: "x",
  }),
);

// invalid: empty essay is rejected
assert.throws(() =>
  parseInput(CreateWritingResponseSchema, {
    attemptId: "11111111-1111-4111-8111-111111111111",
    questionId: "22222222-2222-4222-8222-222222222222",
    essay: "",
  }),
);

console.log("IELTS data-model boundary smoke tests passed");
