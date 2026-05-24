import assert from "node:assert/strict";

import { DASHBOARD_SKILL_ORDER, type DailyStatEntry } from "@thinkfy/shared/dashboard";

import { buildWeeklyGoalSummary } from "./dashboard";

function stat(minutes: number): DailyStatEntry {
  return {
    date: "2026-05-18",
    sessions_completed: minutes > 0 ? 1 : 0,
    practice_minutes: minutes,
    xp_earned: minutes,
  };
}

function profile(preferences: Record<string, unknown>) {
  return { preferences };
}

{
  const summary = buildWeeklyGoalSummary(
    profile({ weekly_goal_minutes: 150, daily_goal_minutes: 20 }),
    [stat(30), stat(40), stat(50)]
  );

  assert.equal(summary.goalMinutes, 150);
  assert.equal(summary.practicedMinutes, 120);
  assert.equal(summary.remainingMinutes, 30);
  assert.equal(summary.progressPercent, 80);
  assert.equal(summary.metGoal, false);
}

{
  const summary = buildWeeklyGoalSummary(
    profile({ daily_goal_minutes: 15 }),
    [stat(90), stat(30)]
  );

  assert.equal(summary.goalMinutes, 105);
  assert.equal(summary.practicedMinutes, 120);
  assert.equal(summary.remainingMinutes, 0);
  assert.equal(summary.progressPercent, 100);
  assert.equal(summary.metGoal, true);
}

{
  const summary = buildWeeklyGoalSummary(
    profile({ dailyCommitment: 10 }),
    [stat(12), stat(8)]
  );

  assert.equal(summary.goalMinutes, 70);
  assert.equal(summary.practicedMinutes, 20);
  assert.equal(summary.remainingMinutes, 50);
  assert.equal(summary.progressPercent, 29);
  assert.equal(summary.metGoal, false);
}

{
  const summary = buildWeeklyGoalSummary(null, [stat(20), stat(25)]);

  assert.equal(summary.goalMinutes, 100);
  assert.equal(summary.practicedMinutes, 45);
  assert.equal(summary.remainingMinutes, 55);
  assert.equal(summary.progressPercent, 45);
  assert.equal(summary.metGoal, false);
}

assert.deepEqual(DASHBOARD_SKILL_ORDER, [
  "clarity",
  "logic",
  "rebuttal",
  "evidence",
  "delivery",
]);

console.info("dashboard data tests passed");
