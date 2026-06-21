import assert from "node:assert/strict";
import type { IeltsReviewSessionItemRow } from "./session";
import { buildIeltsReviewSessionView } from "./session";

function row(overrides: Partial<IeltsReviewSessionItemRow> = {}): IeltsReviewSessionItemRow {
  return {
    id: "review-1",
    skill: "reading",
    focus_area: "matching_headings",
    review_kind: "mistake_card",
    prompt_en: "What does Not Given mean?",
    prompt_vi: "Not Given nghĩa là gì?",
    answer_en: "The passage does not say.",
    answer_vi: "Bài đọc không nêu thông tin đó.",
    due_at: "2026-06-21T10:00:00.000Z",
    state: "review",
    ...overrides,
  };
}

{
  const view = buildIeltsReviewSessionView(
    [
      row({ id: "later", due_at: "2026-06-21T12:00:00.000Z" }),
      row({ id: "earlier", due_at: "2026-06-20T12:00:00.000Z" }),
    ],
    { now: "2026-06-21T15:00:00.000Z" },
  );
  assert.equal(view.generatedAt, "2026-06-21T15:00:00.000Z");
  assert.equal(view.dueCount, 2);
  assert.deepEqual(
    view.items.map((item) => item.id),
    ["earlier", "later"],
  );
  assert.equal(view.items[0].isOverdue, true);
  assert.equal(view.items[1].isOverdue, false);
  assert.deepEqual(
    view.items.map((item) => item.position),
    [1, 2],
  );
}

{
  const view = buildIeltsReviewSessionView(
    [row({ answer_en: null, answer_vi: null })],
    { now: "2026-06-21T15:00:00.000Z" },
  );
  assert.equal(view.items[0].answerEn, null);
  assert.equal(view.items[0].answerVi, null);
}

console.log("ielts/review/session.test.ts passed");
