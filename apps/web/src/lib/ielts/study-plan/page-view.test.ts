import assert from "node:assert/strict";
import {
  fixtureIeltsBandPrediction,
  fixtureIeltsGoal,
  lowConfidenceIeltsBandPrediction,
} from "@/lib/ielts/adaptive/contracts";
import {
  buildIeltsStudyPlanPageView,
  studyPlanModeForDays,
  type BuildIeltsStudyPlanPageViewInput,
  type StudyPlanItemRow,
  type StudyPlanRevisionRow,
  type StudyPlanReviewRow,
  type StudyPlanRow,
} from "./page-view";

const TODAY = "2026-08-17";
const NOW = "2026-08-17T08:00:00.000Z";

function planRow(overrides: Partial<StudyPlanRow> = {}): StudyPlanRow {
  return {
    id: "plan-1",
    module: "academic",
    status: "active",
    plan_version: 2,
    plan_horizon_days: 14,
    target_test_date: fixtureIeltsGoal.targetTestDate,
    target_overall_band: 6.5,
    focus_skills: ["writing", "speaking"],
    study_days: [1, 3, 5],
    daily_minutes: 30,
    predicted_overall_band: 6,
    predicted_listening_band: 6,
    predicted_reading_band: 5.5,
    predicted_writing_band: 5.5,
    predicted_speaking_band: 6,
    prediction_confidence: 0.62,
    generated_at: "2026-08-17T00:00:00.000Z",
    last_replanned_at: null,
    next_reassessment_at: "2026-08-24T00:00:00.000Z",
    explanation: {
      rationale: {
        en: "Plan targets reading and writing gaps.",
        vi: "Kế hoạch nhắm vào khoảng cách reading và writing.",
      },
    },
    ...overrides,
  };
}

function itemRow(overrides: Partial<StudyPlanItemRow> = {}): StudyPlanItemRow {
  return {
    id: "item-x",
    kind: "learn_activity",
    status: "scheduled",
    scheduled_date: TODAY,
    skill: "reading",
    focus_area: "matching headings",
    estimated_minutes: 15,
    priority_score: 5,
    rationale_en: "Targets a critical reading weakness.",
    rationale_vi: "Nhắm vào điểm yếu reading nghiêm trọng.",
    source_weakness_keys: ["reading:matching_headings"],
    metadata: { titleEn: "Matching headings drill", titleVi: "Luyện ghép tiêu đề" },
    ...overrides,
  };
}

function reviewRow(overrides: Partial<StudyPlanReviewRow> = {}): StudyPlanReviewRow {
  return {
    id: "review-x",
    skill: "listening",
    focus_area: "map labels",
    review_kind: "trap",
    prompt_en: "Recall the distractor pattern.",
    prompt_vi: "Nhớ lại mẫu gây nhiễu.",
    due_at: "2026-08-17T06:00:00.000Z",
    state: "review",
    ...overrides,
  };
}

const ITEMS: StudyPlanItemRow[] = [
  itemRow({ id: "a", scheduled_date: TODAY, skill: "reading", priority_score: 9, estimated_minutes: 15 }),
  itemRow({
    id: "b",
    scheduled_date: TODAY,
    skill: "writing",
    kind: "learn_activity",
    priority_score: 7,
    estimated_minutes: 12,
  }),
  itemRow({ id: "c", scheduled_date: "2026-08-19", skill: "listening", kind: "review", priority_score: 5, estimated_minutes: 5 }),
  itemRow({ id: "d", scheduled_date: "2026-08-24", skill: "reading", kind: "mini_mock", priority_score: 8, estimated_minutes: 30 }),
  // Outside the 14-day window — should surface as a reassessment mock, not a calendar item.
  itemRow({ id: "e", scheduled_date: "2026-09-01", skill: "reading", kind: "full_mock", priority_score: 8, estimated_minutes: 60 }),
  // Before today, unresolved -> overdue. Completed past item must NOT be overdue.
  itemRow({ id: "f", scheduled_date: "2026-08-10", skill: "speaking", priority_score: 4, status: "scheduled" }),
  itemRow({ id: "g", scheduled_date: "2026-08-10", skill: "writing", priority_score: 4, status: "completed" }),
];

function baseInput(overrides: Partial<BuildIeltsStudyPlanPageViewInput> = {}): BuildIeltsStudyPlanPageViewInput {
  return {
    plan: planRow(),
    goal: fixtureIeltsGoal,
    items: ITEMS,
    reviews: [],
    revisions: [],
    prediction: fixtureIeltsBandPrediction,
    todayIso: TODAY,
    now: NOW,
    hasDiagnosticTest: true,
    ...overrides,
  };
}

// --- Status gating (diagnostic-first) ----------------------------------------
{
  const noPlan = buildIeltsStudyPlanPageView(baseInput({ plan: null, goal: null, items: [] }));
  assert.equal(noPlan.status, "no_plan");
  assert.equal(noPlan.countdown, null);
  assert.equal(noPlan.calendar.days.length, 0);
  // Prediction block is still built so the page can show diagnostic messaging.
  assert.equal(noPlan.prediction.skills.length, 4);

  const ready = buildIeltsStudyPlanPageView(baseInput());
  assert.equal(ready.status, "ready");

  const needsDiagnostic = buildIeltsStudyPlanPageView(
    baseInput({ prediction: lowConfidenceIeltsBandPrediction }),
  );
  assert.equal(needsDiagnostic.status, "needs_diagnostic");
  assert.equal(needsDiagnostic.prediction.overallBand, null);
}

// --- Countdown + mode --------------------------------------------------------
{
  const view = buildIeltsStudyPlanPageView(baseInput());
  assert.ok(view.countdown);
  assert.equal(view.countdown.testDate, "2026-09-01");
  assert.equal(view.countdown.daysUntilTest, 15);
  assert.equal(view.countdown.isPastTestDate, false);
  assert.equal(view.countdown.mode, "sprint");

  assert.equal(studyPlanModeForDays(13), "cram");
  assert.equal(studyPlanModeForDays(14), "sprint");
  assert.equal(studyPlanModeForDays(42), "sprint");
  assert.equal(studyPlanModeForDays(43), "standard");
  assert.equal(studyPlanModeForDays(120), "standard");
  assert.equal(studyPlanModeForDays(121), "long_horizon");
}

// --- 14-day calendar ---------------------------------------------------------
{
  const { calendar } = buildIeltsStudyPlanPageView(baseInput());
  assert.equal(calendar.days.length, 14);
  assert.equal(calendar.startDate, TODAY);
  assert.equal(calendar.endDate, "2026-08-30");
  assert.equal(calendar.horizonDays, 14);

  const today = calendar.days[0];
  assert.equal(today.date, TODAY);
  assert.equal(today.isToday, true);
  assert.equal(calendar.days.slice(1).every((day) => !day.isToday), true);

  // Today holds items a + b, sorted by priority desc, minutes summed.
  assert.deepEqual(today.items.map((item) => item.id), ["a", "b"]);
  assert.equal(today.plannedMinutes, 27);

  // Study-day flag follows the plan's ISO weekdays (Mon/Wed/Fri).
  const monday = calendar.days.find((day) => day.isoWeekday === 1);
  const tuesday = calendar.days.find((day) => day.isoWeekday === 2);
  assert.ok(monday && tuesday);
  assert.equal(monday.isStudyDay, true);
  assert.equal(tuesday.isStudyDay, false);

  // Only in-window items count (a, b, c, d). e is beyond, f/g are before today.
  assert.equal(calendar.totalItemCount, 4);

  // Overdue = unresolved past items only (f); completed g is excluded.
  assert.deepEqual(calendar.overdue.map((item) => item.id), ["f"]);

  // Title falls back to focus_area when metadata has no title.
  const noTitle = buildIeltsStudyPlanPageView(
    baseInput({ items: [itemRow({ id: "n", scheduled_date: TODAY, metadata: {} })] }),
  );
  assert.equal(noTitle.calendar.days[0].items[0].titleEn, "matching headings");
}

// --- Weekly forecast ---------------------------------------------------------
{
  const { weeklyForecast } = buildIeltsStudyPlanPageView(baseInput());
  assert.equal(weeklyForecast.length, 2);

  const [week1, week2] = weeklyForecast;
  assert.equal(week1.index, 1);
  assert.equal(week1.startDate, TODAY);
  assert.equal(week1.itemCount, 3); // a, b (today) + c (08-19)
  assert.equal(week1.plannedMinutes, 32);
  const learn = week1.byKind.find((entry) => entry.kind === "learn_activity");
  assert.deepEqual(learn, { kind: "learn_activity", count: 2, minutes: 27 });
  const readingSkill = week1.bySkill.find((entry) => entry.skill === "reading");
  assert.deepEqual(readingSkill, { skill: "reading", count: 1, minutes: 15 });

  assert.equal(week2.index, 2);
  assert.equal(week2.itemCount, 1); // d (08-24)
  assert.equal(week2.plannedMinutes, 30);
  assert.deepEqual(week2.byKind, [{ kind: "mini_mock", count: 1, minutes: 30 }]);
}

// --- Review queue: due vs upcoming, overdue flag -----------------------------
{
  const reviews: StudyPlanReviewRow[] = [
    reviewRow({ id: "r1", due_at: "2026-08-10T10:00:00.000Z" }), // overdue
    reviewRow({ id: "r2", due_at: "2026-08-17T06:00:00.000Z" }), // due today, not overdue
    reviewRow({ id: "r3", due_at: "2026-08-25T10:00:00.000Z" }), // upcoming
  ];
  const { reviewQueue } = buildIeltsStudyPlanPageView(baseInput({ reviews }));
  assert.equal(reviewQueue.dueCount, 2);
  assert.equal(reviewQueue.upcomingCount, 1);
  assert.deepEqual(reviewQueue.due.map((review) => review.id), ["r1", "r2"]);
  assert.equal(reviewQueue.due[0].isOverdue, true); // r1: due 08-10 < today
  assert.equal(reviewQueue.due[1].isOverdue, false); // r2: due today
  assert.equal(reviewQueue.upcoming[0].id, "r3");
}

// --- Reassessment schedule ---------------------------------------------------
{
  const { reassessment } = buildIeltsStudyPlanPageView(baseInput());
  assert.equal(reassessment.nextReassessmentAt, "2026-08-24T00:00:00.000Z");
  // Both mocks (in-window mini_mock d + out-of-window full_mock e), date-sorted.
  assert.deepEqual(reassessment.mocks.map((mock) => mock.id), ["d", "e"]);
  assert.equal(reassessment.mocks[0].kind, "mini_mock");
  assert.equal(reassessment.mocks[1].kind, "full_mock");
  assert.equal(reassessment.mocks.every((mock) => !mock.isPast), true);
}

// --- Reasoning: gaps + top weaknesses ----------------------------------------
{
  const { prediction, reasoning } = buildIeltsStudyPlanPageView(baseInput());
  assert.equal(reasoning.planRationaleEn, "Plan targets reading and writing gaps.");

  const writing = prediction.skills.find((skill) => skill.skill === "writing");
  assert.ok(writing);
  assert.equal(writing.predictedBand, 5.5);
  assert.equal(writing.targetBand, 7); // explicit per-skill target
  assert.equal(writing.gapBands, 1.5);
  assert.equal(writing.isFocus, true);

  const reading = prediction.skills.find((skill) => skill.skill === "reading");
  assert.ok(reading);
  assert.equal(reading.targetBand, 6.5); // falls back to overall target
  assert.equal(reading.gapBands, 1);
  assert.equal(reading.isFocus, false);

  // Weaknesses sorted critical-first, then by confidence.
  assert.ok(reasoning.weaknesses.length > 0);
  assert.equal(reasoning.weaknesses[0].severity, "critical");
  assert.equal(reasoning.weaknesses[0].key, "reading:matching_headings");
}

// --- Revision log: newest-first, mapped --------------------------------------
{
  const revisions: StudyPlanRevisionRow[] = [
    {
      id: "rev-1",
      from_version: 1,
      to_version: 2,
      trigger_type: "goal_edit",
      trigger_source_type: null,
      summary_en: "You raised your Writing target to 7.0.",
      summary_vi: "Bạn đã nâng mục tiêu Writing lên 7.0.",
      changed_item_count: 4,
      created_at: "2026-08-15T09:00:00.000Z",
    },
    {
      id: "rev-2",
      from_version: 2,
      to_version: 3,
      trigger_type: "prediction_snapshot",
      trigger_source_type: "ielts_attempt",
      summary_en: "Reading rose to 6.0, so two drills were rescheduled.",
      summary_vi: "Reading tăng lên 6.0, nên hai bài luyện đã được dời.",
      changed_item_count: 2,
      created_at: "2026-08-16T09:00:00.000Z",
    },
  ];
  const view = buildIeltsStudyPlanPageView(baseInput({ revisions }));
  assert.deepEqual(view.revisions.map((rev) => rev.id), ["rev-2", "rev-1"]);
  assert.equal(view.revisions[0].toVersion, 3);
  assert.equal(view.revisions[0].triggerSourceType, "ielts_attempt");
  assert.equal(view.revisions[0].changedItemCount, 2);
}

console.log("page-view.test.ts: all assertions passed");
