import assert from "node:assert/strict";
import type { StreakActivityEvent } from "@/lib/streaks/model";
import {
  buildIeltsHomeRetentionView,
  todayIsoForIeltsRetention,
  type IeltsRetentionDailyStatRow,
  type IeltsRetentionPlanItemRow,
  type IeltsRetentionPlanRow,
  type IeltsRetentionProfileRow,
  type IeltsRetentionReviewRow,
  type IeltsRetentionTodayItemSummary,
} from "./retention";

const NOW = new Date("2026-06-21T10:00:00.000Z");
const TODAY = "2026-06-21";

const profile: IeltsRetentionProfileRow = {
  streak_current: 1,
  streak_longest: 5,
  streak_last_active_date: "2026-06-20",
  xp: 1_250,
  level: 3,
};

const plan: IeltsRetentionPlanRow = {
  daily_minutes: 40,
  timezone: "UTC",
};

function planItem(overrides: Partial<IeltsRetentionPlanItemRow> = {}): IeltsRetentionPlanItemRow {
  return {
    id: "item-1",
    status: "scheduled",
    scheduled_date: TODAY,
    estimated_minutes: 20,
    completed_at: null,
    ...overrides,
  };
}

function stat(overrides: Partial<IeltsRetentionDailyStatRow> = {}): IeltsRetentionDailyStatRow {
  return {
    date: TODAY,
    minutes_studied: 18,
    practice_minutes: 12,
    xp_earned: 25,
    sessions_completed: 1,
    ...overrides,
  };
}

function review(overrides: Partial<IeltsRetentionReviewRow> = {}): IeltsRetentionReviewRow {
  return {
    id: "review-1",
    due_at: "2026-06-21T08:00:00.000Z",
    ...overrides,
  };
}

const activities: StreakActivityEvent[] = [
  {
    activity_type: "lesson_completed",
    reference_type: "activity",
    created_at: "2026-06-21T08:00:00.000Z",
  },
  {
    activity_type: "lesson_completed",
    reference_type: "activity",
    created_at: "2026-06-20T08:00:00.000Z",
  },
];

const todayItems: IeltsRetentionTodayItemSummary[] = [
  {
    titleEn: "Scan for names",
    titleVi: "Quét tìm tên riêng",
    launchHref: "/ielts/mock/scan-names",
  },
];

// todayIsoForIeltsRetention uses the learner's plan timezone.
assert.equal(todayIsoForIeltsRetention(NOW, "UTC"), TODAY);
assert.equal(todayIsoForIeltsRetention(NOW, "Asia/Ho_Chi_Minh"), "2026-06-21");
assert.equal(todayIsoForIeltsRetention(new Date("2026-06-20T22:30:00.000Z"), "Asia/Ho_Chi_Minh"), TODAY);

// Full view: shared streak state, plan minutes, XP model, due reviews, nudge.
{
  const view = buildIeltsHomeRetentionView({
    profile,
    plan,
    planItems: [
      planItem({ id: "a" }),
      planItem({
        id: "b",
        status: "completed",
        completed_at: "2026-06-21T09:00:00.000Z",
        estimated_minutes: 15,
      }),
    ],
    todayStat: stat(),
    reviewsDue: [
      review({ id: "r1", due_at: "2026-06-20T08:00:00.000Z" }),
      review({ id: "r2" }),
    ],
    todayItems,
    todayDueCount: 3,
    todayOverflowCount: 2,
    activities,
    now: NOW,
  });

  assert.equal(view.streak.current, 2, "streak comes from qualifying activity log events");
  assert.equal(view.streak.longest, 5, "profile longest streak is preserved");
  assert.equal(view.streak.activeToday, true);
  assert.equal(view.dailyGoal.hasPlan, true);
  assert.equal(view.dailyGoal.minutesGoal, 40);
  assert.equal(view.dailyGoal.minutesDone, 18, "daily_stats minutes win when higher than completed item minutes");
  assert.equal(view.dailyGoal.progressPercent, 45);
  assert.equal(view.dailyGoal.itemsDoneToday, 1);
  assert.equal(view.dailyGoal.itemsPlannedToday, 2);
  assert.equal(view.xp.level, 3);
  assert.equal(view.xp.lifetimeXp, 1_250);
  assert.equal(view.xp.xpInLevel, 250);
  assert.equal(view.xp.xpToNextLevel, 250);
  assert.equal(view.nudge.reviewsDueCount, 2);
  assert.equal(view.nudge.reviewsOverdueCount, 1);
  assert.equal(view.nudge.todayDueCount, 3);
  assert.equal(view.nudge.todayOverflowCount, 2);
  assert.equal(view.nudge.nextTitleEn, "Scan for names");
  assert.equal(view.nudge.nextHref, "/ielts/mock/scan-names");
}

// Completed plan items provide a display fallback when daily_stats has not caught up.
{
  const view = buildIeltsHomeRetentionView({
    profile,
    plan,
    planItems: [
      planItem({
        id: "done",
        status: "completed",
        completed_at: "2026-06-21T08:10:00.000Z",
        estimated_minutes: 25,
      }),
    ],
    todayStat: stat({ minutes_studied: 0, practice_minutes: 0, xp_earned: 0, sessions_completed: 0 }),
    reviewsDue: [],
    todayItems: [],
    todayDueCount: 0,
    todayOverflowCount: 0,
    activities: [],
    now: NOW,
  });

  assert.equal(view.dailyGoal.minutesDone, 25);
  assert.equal(view.dailyGoal.progressPercent, 63);
  assert.equal(view.nudge.nextHref, "/ielts/study-plan");
}

// No plan/profile degrades without inventing a separate ledger.
{
  const view = buildIeltsHomeRetentionView({
    profile: null,
    plan: null,
    planItems: [],
    todayStat: null,
    reviewsDue: [],
    todayItems: [],
    todayDueCount: 0,
    todayOverflowCount: 0,
    activities: undefined,
    now: NOW,
  });

  assert.equal(view.streak.current, 0);
  assert.equal(view.dailyGoal.hasPlan, false);
  assert.equal(view.dailyGoal.minutesGoal, 0);
  assert.equal(view.dailyGoal.progressPercent, 0);
  assert.equal(view.xp.level, 1);
  assert.equal(view.xp.lifetimeXp, 0);
}

console.log("retention.test.ts: all assertions passed");
