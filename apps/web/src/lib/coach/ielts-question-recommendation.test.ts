import assert from "node:assert/strict";
import test from "node:test";

import { findIeltsQuestionRecommendation } from "./ielts-question-recommendation";

function fakeClient(rows: unknown[]) {
  const query = {
    select: () => query,
    eq: () => query,
    contains: () => query,
    order: () => query,
    limit: async () => ({ data: rows, error: null }),
  };
  return { from: () => query } as never;
}

test("ranks a published criterion-matched question without reading answer keys", async () => {
  const calls: string[] = [];
  const equalityFilters: Array<[string, unknown]> = [];
  const containmentFilters: Array<[string, unknown]> = [];
  const query = {
    select: (columns: string) => {
      calls.push(columns);
      return query;
    },
    eq: (column: string, value: unknown) => {
      equalityFilters.push([column, value]);
      return query;
    },
    contains: (column: string, value: unknown) => {
      containmentFilters.push([column, value]);
      return query;
    },
    order: () => query,
    limit: async () => ({
      error: null,
      data: [
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          test_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          question_type: "writing_task2_essay",
          prompt: "Discuss whether cities should invest in public transport.",
          metadata: { coach_criteria: ["task_response"] },
          ielts_tests: {
            id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            slug: "coach-writing-task-2-v1",
            title: "Coach Writing Task 2",
            status: "published",
          },
        },
      ],
    }),
  };
  const result = await findIeltsQuestionRecommendation({
    supabase: { from: () => query } as never,
    skill: "writing",
    criterion: "task_response",
    message: "I need a public transport Task 2 drill",
  });
  assert.equal(result?.testSlug, "coach-writing-task-2-v1");
  assert.match(result?.resourceId ?? "", /^ielts-practice:writing:/);
  assert.equal(
    calls.some((columns) => columns.includes("question_keys")),
    false,
  );
  assert.equal(
    calls.some((columns) => columns.includes("model_answer")),
    false,
  );
  assert.deepEqual(containmentFilters, [
    ["metadata", { coach_recommendable: true }],
  ]);
  assert.equal(
    equalityFilters.some(
      ([column, value]) =>
        column === "ielts_tests.assessment_mode" && value === "practice",
    ),
    true,
  );
});

test("returns null when the safe question query is unavailable", async () => {
  const result = await findIeltsQuestionRecommendation({
    supabase: fakeClient([]),
    skill: "speaking",
    criterion: "pronunciation",
    message: "Give me a speaking drill",
  });
  assert.equal(result, null);
});

test("an explicit Speaking part outranks an earlier generic criterion match", async () => {
  const rows = [
    {
      id: "11111111-1111-4111-8111-111111111111",
      test_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      question_type: "speaking_part1",
      prompt: "Tell me about your daily routine.",
      metadata: { coach_criteria: ["fluency_and_coherence"] },
      ielts_tests: {
        slug: "speaking-practice",
        title: "Speaking practice",
        status: "published",
      },
    },
    {
      id: "22222222-2222-4222-8222-222222222222",
      test_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      question_type: "speaking_part2_cuecard",
      prompt: "Describe a skill you learned recently.",
      metadata: { coach_criteria: ["fluency_and_coherence"] },
      ielts_tests: {
        slug: "speaking-practice",
        title: "Speaking practice",
        status: "published",
      },
    },
  ];
  const result = await findIeltsQuestionRecommendation({
    supabase: fakeClient(rows),
    skill: "speaking",
    criterion: "fluency_and_coherence",
    message: "Cho tôi một bài luyện Speaking Phần 2 ngay bây giờ.",
  });
  assert.equal(result?.questionType, "speaking_part2_cuecard");
});

test("an explicit Writing task and module outrank lexical overlap", async () => {
  const rows = [
    {
      id: "33333333-3333-4333-8333-333333333333",
      test_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      question_type: "writing_task2_essay",
      prompt: "Discuss the advantages of public transport.",
      metadata: { coach_criteria: ["task_response"] },
      ielts_tests: {
        slug: "writing-practice",
        title: "Writing practice",
        status: "published",
      },
    },
    {
      id: "44444444-4444-4444-8444-444444444444",
      test_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      question_type: "writing_task1_general",
      prompt: "Write a letter about a delayed bus service.",
      metadata: { coach_criteria: ["task_response"] },
      ielts_tests: {
        slug: "writing-practice",
        title: "Writing practice",
        status: "published",
      },
    },
  ];
  const result = await findIeltsQuestionRecommendation({
    supabase: fakeClient(rows),
    skill: "writing",
    criterion: "task_response",
    message: "I want a General Training Writing Task 1 public transport drill.",
  });
  assert.equal(result?.questionType, "writing_task1_general");
});
