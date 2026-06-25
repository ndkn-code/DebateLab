import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  DASHBOARD_SKILL_ORDER,
  type DailyStatEntry,
  type DashboardGoalSummary,
  type DashboardSkillKey,
  type DashboardSkillSnapshot,
} from "@thinkfy/shared/dashboard";
import type { DebateScore, PracticeTrack } from "@/types/feedback";

import {
  buildSessionDerivedStats,
  buildStreakActivityEventsFromSessions,
  buildWeeklyGoalSummary,
  selectDashboardImprovementSkill,
} from "./dashboard";
import { computeEffectiveStreakState, dateKeyInTimezone } from "@/lib/streaks/model";

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

function goal(progressPercent: number): DashboardGoalSummary {
  return {
    goalMinutes: 100,
    practicedMinutes: progressPercent,
    remainingMinutes: Math.max(100 - progressPercent, 0),
    progressPercent,
    metGoal: progressPercent >= 100,
  };
}

function metric(
  key: DashboardSkillKey,
  value: number,
  coverage = 100
): DashboardSkillSnapshot["metrics"][number] {
  return {
    key,
    rawValue: value,
    challengeAdjustedValue: value,
    value,
    effectiveSessions: coverage >= 100 ? 3 : coverage / 100,
    coverage,
  };
}

function snapshot(
  overrides: Partial<Record<DashboardSkillKey, { value: number; coverage?: number }>>
): DashboardSkillSnapshot {
  const metrics = DASHBOARD_SKILL_ORDER.map((key) => {
    const entry = overrides[key] ?? { value: 80 };
    return metric(key, entry.value, entry.coverage ?? 100);
  });
  const covered = metrics.filter((entry) => entry.coverage > 0);
  const sorted = [...covered].sort((left, right) => left.value - right.value);

  return {
    metrics,
    overallScore: null,
    weakestSkill: sorted[0]?.key ?? null,
    strongestSkill: sorted[sorted.length - 1]?.key ?? null,
    sourceSessions: 3,
    confidence: 100,
    trackBreakdown: { speaking: 1, debate: 2 },
    difficultyBreakdown: {
      topic: { beginner: 0, intermediate: 3, advanced: 0 },
      ai: { easy: 0, medium: 2, hard: 0, none: 1 },
    },
  };
}

function feedback(params: {
  track?: PracticeTrack;
  clarity?: number;
  logic?: number;
  rebuttal?: number;
  evidence?: number;
  delivery?: number;
}): DebateScore {
  const delivery = params.delivery ?? 8;

  return {
    content: {
      score: 8,
      claimClarity: params.clarity ?? 8,
      evidenceSupport: params.evidence ?? 8,
      logicCoherence: params.logic ?? 8,
      counterArgument: params.rebuttal ?? 8,
    },
    structure: {
      score: 8,
      introduction: 8,
      bodyOrganization: 8,
      conclusion: 8,
    },
    language: {
      score: 8,
      vocabulary: delivery,
      grammar: Math.min(9, delivery),
      fluency: delivery,
    },
    persuasion: {
      score: 8,
      audienceAwareness: 8,
      impactfulness: 8,
    },
    totalScore: 80,
    overallBand: "Competent",
    summary: "Test score",
    strengths: [],
    improvements: [],
    sampleArguments: [],
    practiceTrack: params.track,
    detailedFeedback: {
      contentFeedback: "",
      structureFeedback: "",
      languageFeedback: "",
      persuasionFeedback: "",
    },
  };
}

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
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

{
  const selected = selectDashboardImprovementSkill(
    snapshot({
      clarity: { value: 30, coverage: 10 },
      evidence: { value: 65, coverage: 100 },
    }),
    [],
    goal(40)
  );

  assert.equal(selected?.key, "evidence");
}

{
  const selected = selectDashboardImprovementSkill(
    snapshot({
      rebuttal: { value: 62 },
      evidence: { value: 64 },
      logic: { value: 74 },
    }),
    [
      {
        feedback: feedback({ track: "debate", rebuttal: 3, evidence: 8 }),
        created_at: daysAgo(1),
      },
      {
        feedback: feedback({ track: "debate", rebuttal: 4, evidence: 8 }),
        created_at: daysAgo(3),
      },
      {
        feedback: feedback({ track: "debate", rebuttal: 4, evidence: 8 }),
        created_at: daysAgo(5),
      },
    ],
    goal(55)
  );

  assert.equal(selected?.key, "evidence");
}

{
  const selected = selectDashboardImprovementSkill(
    snapshot({
      rebuttal: { value: 45 },
      evidence: { value: 69 },
    }),
    [
      {
        feedback: feedback({ track: "debate", rebuttal: 3, evidence: 8 }),
        created_at: daysAgo(1),
      },
      {
        feedback: feedback({ track: "debate", rebuttal: 4, evidence: 8 }),
        created_at: daysAgo(3),
      },
      {
        feedback: feedback({ track: "debate", rebuttal: 4, evidence: 8 }),
        created_at: daysAgo(5),
      },
    ],
    goal(55)
  );

  assert.equal(selected?.key, "rebuttal");
}

{
  const skillSnapshot = snapshot({
    logic: { value: 70 },
    evidence: { value: 82 },
  });
  const behindGoal = selectDashboardImprovementSkill(skillSnapshot, [], goal(15));
  const metGoal = selectDashboardImprovementSkill(skillSnapshot, [], goal(100));

  assert.equal(behindGoal?.key, "logic");
  assert.equal(metGoal?.key, "logic");
  assert.ok((behindGoal?.score ?? 0) > (metGoal?.score ?? 0));
}

{
  const stale = computeEffectiveStreakState({
    profile: {
      streak_current: 2,
      streak_last_active_date: "2026-05-26",
    },
    activities: [],
    timezone: "America/New_York",
    now: new Date("2026-06-13T18:00:00.000Z"),
  });

  assert.equal(stale.current, 0);
}

{
  const active = computeEffectiveStreakState({
    profile: {
      streak_current: 2,
      streak_last_active_date: "2026-06-12",
    },
    activities: [
      {
        activity_type: "debate_completed",
        reference_type: "debate_session",
        created_at: "2026-06-11T14:00:00.000Z",
      },
      {
        activity_type: "duel_completed",
        reference_type: "debate_duel",
        created_at: "2026-06-12T14:00:00.000Z",
      },
    ],
    timezone: "America/New_York",
    now: new Date("2026-06-13T18:00:00.000Z"),
  });

  assert.equal(active.current, 2);
  assert.equal(active.atRiskToday, true);
}

{
  const completedSessions = [
    {
      id: "today-session",
      created_at: "2026-06-23T22:49:06.381Z",
      duration_seconds: 26,
      total_score: 8,
    },
    {
      id: "today-session",
      created_at: "2026-06-23T22:49:06.381Z",
      duration_seconds: 26,
      total_score: 8,
    },
    {
      id: "older-session",
      created_at: "2026-06-15T17:23:09.873Z",
      duration_seconds: 75,
      total_score: 60,
    },
  ];
  const sessionStats = buildSessionDerivedStats(
    completedSessions,
    ["2026-06-23", "2026-06-24"],
    "America/New_York"
  );
  const todayStats = sessionStats.get("2026-06-23");
  const repairedStreak = computeEffectiveStreakState({
    profile: {
      streak_current: 2,
      streak_last_active_date: "2026-05-26",
    },
    activities: buildStreakActivityEventsFromSessions(completedSessions),
    timezone: "America/New_York",
    now: new Date("2026-06-24T03:07:37.901Z"),
  });

  assert.equal(todayStats?.sessions_completed, 1);
  assert.equal(todayStats?.practice_minutes, 0);
  assert.equal(repairedStreak.current, 1);
  assert.equal(repairedStreak.activeToday, true);
}

{
  const timestamp = "2026-06-13T03:30:00.000Z";
  assert.equal(dateKeyInTimezone(timestamp, "America/New_York"), "2026-06-12");
  assert.equal(dateKeyInTimezone(timestamp, "Asia/Ho_Chi_Minh"), "2026-06-13");
}

{
  const mobileRoute = readFileSync("src/app/api/mobile/dashboard/route.ts", "utf8");
  const mobileTodayScreen = readFileSync(
    "../../apps/mobile/src/screens/today-screen.tsx",
    "utf8"
  );

  assert.match(mobileRoute, /searchParams\.get\("timezone"\)/);
  assert.match(mobileRoute, /getDashboardData\(auth\.user\.id, auth\.supabase, \{ timezone \}\)/);
  assert.match(mobileTodayScreen, /resolvedOptions\(\)\.timeZone/);
  assert.match(mobileTodayScreen, /\/api\/mobile\/dashboard\?timezone=/);
}

assert.deepEqual(DASHBOARD_SKILL_ORDER, [
  "clarity",
  "logic",
  "rebuttal",
  "evidence",
  "delivery",
]);

console.info("dashboard data tests passed");
