import assert from "node:assert/strict";
import test from "node:test";

import { findIeltsQuestionRecommendation } from "./ielts-question-recommendation";

function fakeClient(rows: unknown[]) {
  const query = {
    select: () => query,
    eq: () => query,
    order: () => query,
    limit: async () => ({ data: rows, error: null }),
  };
  return { from: () => query } as never;
}

test("ranks a published criterion-matched question without reading answer keys", async () => {
  const calls: string[] = [];
  const query = {
    select: (columns: string) => {
      calls.push(columns);
      return query;
    },
    eq: () => query,
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
