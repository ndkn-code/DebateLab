import assert from "node:assert/strict";
import type { Json } from "@/types/supabase";
import {
  DEFAULT_TODAY_LIMIT,
  buildIeltsTodayList,
  planItemLaunchHref,
  selectTodayPlanItems,
  toIeltsTodayItemView,
  type IeltsPlanItemRow,
} from "./today";

const TODAY = "2026-06-21";

let seq = 0;
function makeItem(overrides: Partial<IeltsPlanItemRow> = {}): IeltsPlanItemRow {
  seq += 1;
  return {
    id: overrides.id ?? `item-${seq}`,
    plan_id: "plan-1",
    user_id: "user-1",
    kind: "learn_activity",
    status: "available",
    skill: "reading",
    focus_area: "matching_headings",
    estimated_minutes: 15,
    priority_score: 0.5,
    scheduled_date: TODAY,
    rationale_en: "Reading is your largest gap to target.",
    rationale_vi: "Đọc là khoảng cách lớn nhất so với mục tiêu.",
    source_weakness_keys: ["reading:matching_headings"],
    source_prediction_snapshot_id: null,
    question_type: null,
    metadata: {} as Json,
    created_at: `${TODAY}T00:00:00.000Z`,
    updated_at: `${TODAY}T00:00:00.000Z`,
    activity_attempt_id: null,
    activity_id: null,
    assignment_id: null,
    available_at: null,
    cancelled_at: null,
    completed_at: null,
    criterion: null,
    due_at: null,
    ielts_attempt_id: null,
    ielts_question_id: null,
    ielts_test_id: null,
    review_item_id: null,
    speaking_response_id: null,
    started_at: null,
    writing_response_id: null,
    ...overrides,
  };
}

// selectTodayPlanItems: only actionable statuses survive --------------------
{
  const items = [
    makeItem({ id: "a", status: "available" }),
    makeItem({ id: "b", status: "scheduled" }),
    makeItem({ id: "c", status: "started" }),
    makeItem({ id: "d", status: "completed" }),
    makeItem({ id: "e", status: "missed" }),
    makeItem({ id: "f", status: "skipped" }),
    makeItem({ id: "g", status: "cancelled" }),
  ];
  const selection = selectTodayPlanItems(items, { today: TODAY, limit: 5 });
  assert.equal(selection.totalActionable, 3, "completed/missed/skipped/cancelled excluded");
  assert.deepEqual(
    selection.items.map((item) => item.id).sort(),
    ["a", "b", "c"],
  );
}

// selectTodayPlanItems: overdue first, then priority, respects limit --------
{
  const items = [
    makeItem({ id: "today-lo", scheduled_date: TODAY, priority_score: 0.2 }),
    makeItem({ id: "today-hi", scheduled_date: TODAY, priority_score: 0.9 }),
    makeItem({ id: "overdue", scheduled_date: "2026-06-19", priority_score: 0.1 }),
    makeItem({ id: "future", scheduled_date: "2026-06-25", priority_score: 0.99 }),
  ];
  const selection = selectTodayPlanItems(items, { today: TODAY, limit: 2 });
  // Overdue wins the first slot despite the lowest priority; then today's highest.
  assert.deepEqual(
    selection.items.map((item) => item.id),
    ["overdue", "today-hi"],
  );
  assert.equal(selection.dueCount, 3, "overdue + both today items are due");
  assert.equal(selection.overflowCount, 2, "4 actionable − 2 shown");
}

// selectTodayPlanItems: limit defaults + clamps ----------------------------
{
  const items = Array.from({ length: 9 }, (_, i) =>
    makeItem({ id: `n-${i}`, priority_score: i / 10 }),
  );
  assert.equal(
    selectTodayPlanItems(items, { today: TODAY }).items.length,
    DEFAULT_TODAY_LIMIT,
  );
  assert.equal(
    selectTodayPlanItems(items, { today: TODAY, limit: 99 }).items.length,
    5,
    "limit clamps to 5",
  );
  assert.equal(
    selectTodayPlanItems(items, { today: TODAY, limit: 0 }).items.length,
    1,
    "limit clamps to >= 1",
  );
}

// planItemLaunchHref: each kind resolves to a real destination --------------
{
  const ctx = { testSlugById: new Map([["test-9", "academic-mock-1"]]) };

  assert.equal(
    planItemLaunchHref(
      makeItem({ kind: "full_mock", ielts_test_id: "test-9" }),
      ctx,
    ),
    "/ielts/mock/academic-mock-1",
  );
  assert.equal(
    planItemLaunchHref(
      makeItem({ kind: "mini_mock", ielts_test_id: "unknown" }),
      ctx,
    ),
    "/ielts/tests",
    "unresolved mock falls back to the library",
  );
  assert.equal(
    planItemLaunchHref(makeItem({ kind: "teacher_assignment" }), ctx),
    "/ielts/assigned",
  );
  assert.equal(
    planItemLaunchHref(makeItem({ kind: "learn_activity" }), ctx),
    "/ielts/learn",
  );
  assert.equal(
    planItemLaunchHref(makeItem({ kind: "review" }), ctx),
    "/ielts/study-plan",
  );
  assert.equal(
    planItemLaunchHref(
      makeItem({ kind: "writing_submission", ielts_test_id: "test-9" }),
      ctx,
    ),
    "/ielts/mock/academic-mock-1",
  );
  assert.equal(
    planItemLaunchHref(makeItem({ kind: "speaking_submission" }), ctx),
    "/ielts/study-plan",
    "a submission without a test falls back to the plan",
  );
}

// toIeltsTodayItemView: title from metadata, overdue flag, launch ----------
{
  const view = toIeltsTodayItemView(
    makeItem({
      kind: "learn_activity",
      scheduled_date: "2026-06-18",
      metadata: { titleEn: "Skim & scan drill", titleVi: "Luyện đọc lướt" } as Json,
    }),
    { today: TODAY, testSlugById: new Map() },
  );
  assert.equal(view.titleEn, "Skim & scan drill");
  assert.equal(view.titleVi, "Luyện đọc lướt");
  assert.equal(view.isOverdue, true, "scheduled before today → overdue");
  assert.equal(view.launchHref, "/ielts/learn");
  assert.equal(view.rationaleEn, "Reading is your largest gap to target.");
}

// toIeltsTodayItemView: missing metadata title → humanized focus_area ------
{
  const view = toIeltsTodayItemView(
    makeItem({ focus_area: "matching_headings", metadata: {} as Json }),
    { today: TODAY, testSlugById: new Map() },
  );
  assert.equal(view.titleEn, "Matching headings");
  assert.equal(view.isOverdue, false, "scheduled today is not overdue");
}

// buildIeltsTodayList: end-to-end -----------------------------------------
{
  const result = buildIeltsTodayList(
    [
      makeItem({ id: "x", kind: "full_mock", ielts_test_id: "t1", scheduled_date: TODAY }),
      makeItem({ id: "y", status: "completed" }),
    ],
    { today: TODAY, testSlugById: new Map([["t1", "mock-slug"]]), limit: 4 },
  );
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].launchHref, "/ielts/mock/mock-slug");
  assert.equal(result.totalActionable, 1);
  assert.equal(result.overflowCount, 0);
}

console.log("today.test.ts: all assertions passed");
