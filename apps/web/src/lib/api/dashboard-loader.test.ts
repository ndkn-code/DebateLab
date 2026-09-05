import assert from "node:assert/strict";
import { test } from "node:test";
import { getDashboardData } from "./dashboard";
import {
  createDashboardFixtureClient,
  dashboardFixtureProfile,
  dashboardFixtureSession,
  DASHBOARD_FIXTURE_NOW,
  DASHBOARD_FIXTURE_USER,
} from "./__fixtures__/dashboard";

const options = { now: DASHBOARD_FIXTURE_NOW, timezone: "UTC" };
const allSources = [
  "profile",
  "enrollments",
  "recentSessions",
  "scoredSessions",
  "stats",
  "activityLog",
] as const;

test("confirmed empty loader result selects a starter, keeps skills unmeasured and persisted goals", async () => {
  const { client, calls } = createDashboardFixtureClient();
  const data = await getDashboardData(DASHBOARD_FIXTURE_USER, client, options);
  assert.equal(data.recommendedDrill.key, "start-speaking");
  assert.equal(data.availability.recommendation, "starter");
  assert.equal(data.skillSnapshot.overallScore, null);
  assert.equal(data.skillSnapshot.weakestSkill, null);
  assert.equal(data.hero.todayGoal.goalMinutes, 20);
  assert.deepEqual(
    data.profile?.preferences,
    dashboardFixtureProfile.preferences,
  );
  assert.ok(calls.every((call) => call.owner === DASHBOARD_FIXTURE_USER));
});

test("RPC plus fallback failure exposes unavailable sources, including rejected promises", async () => {
  for (const reject of [false, true]) {
    const { client } = createDashboardFixtureClient({
      rpc: "reject",
      ...(reject
        ? { rejections: [...allSources] }
        : { failures: [...allSources] }),
    });
    const data = await getDashboardData(
      DASHBOARD_FIXTURE_USER,
      client,
      options,
    );
    assert.ok(
      allSources.every((source) => data.availability[source] === "unavailable"),
    );
    assert.equal(data.availability.recommendation, "unavailable");
    assert.equal(data.recommendedDrill.key, "start-speaking");
    assert.equal(data.profile, null);
  }
});

test("error responses cannot smuggle stale data into trusted model fields", async () => {
  const { client } = createDashboardFixtureClient({
    failures: [...allSources],
    errorWithData: true,
    sources: { recentSessions: [dashboardFixtureSession("debate")] },
  });
  const data = await getDashboardData(DASHBOARD_FIXTURE_USER, client, options);
  assert.equal(data.profile, null);
  assert.deepEqual(data.recentActivity, []);
  assert.equal(data.availability.stats, "unavailable");
  assert.equal(data.availability.recommendation, "unavailable");
});

test("valid RPC sources survive malformed siblings and failing fallback queries", async () => {
  const { client, calls } = createDashboardFixtureClient({
    rpc: {
      error: null,
      data: {
        profile: dashboardFixtureProfile,
        enrollments: [],
        recent_sessions: [dashboardFixtureSession("speaking")],
        scored_sessions: "bad",
        stats: null,
      },
    },
    failures: ["scoredSessions", "stats"],
  });
  const data = await getDashboardData(DASHBOARD_FIXTURE_USER, client, options);
  assert.equal(data.topBar.orbBalance, 1250);
  assert.equal(data.recentActivity.length, 1);
  assert.equal(data.availability.scoredSessions, "unavailable");
  assert.equal(data.availability.stats, "partial");
  assert.equal(data.recommendedDrill.key, "underused-track");
  assert.equal(data.recommendedDrill.track, "debate");
  assert.deepEqual(calls.map((call) => call.source).sort(), [
    "activityLog",
    "scoredSessions",
    "stats",
  ]);
});

test("partial fallback keeps profile and history; successful retry restores complete progress", async () => {
  const sources = {
    recentSessions: [dashboardFixtureSession("debate")],
    stats: [
      {
        date: "2026-09-05",
        sessions_completed: 2,
        minutes_studied: 20,
        xp_earned: 50,
      },
    ],
  };
  const failed = await getDashboardData(
    DASHBOARD_FIXTURE_USER,
    createDashboardFixtureClient({
      sources,
      rejections: ["stats", "activityLog"],
    }).client,
    options,
  );
  assert.equal(failed.recentActivity.length, 1);
  assert.equal(failed.availability.stats, "partial");
  assert.equal(
    failed.hero.weeklyStats.reduce(
      (sum, row) => sum + row.sessions_completed,
      0,
    ),
    1,
  );
  assert.equal(failed.recommendedDrill.track, "speaking");
  const restored = await getDashboardData(
    DASHBOARD_FIXTURE_USER,
    createDashboardFixtureClient({ sources }).client,
    options,
  );
  assert.equal(restored.availability.stats, "available");
  assert.equal(restored.hero.todayGoal.practicedMinutes, 20);
  assert.equal(
    restored.hero.todayGoal.goalMinutes,
    failed.hero.todayGoal.goalMinutes,
  );
});

test("equal explicit history and unknown unscored tracks cannot imply an imbalance", async () => {
  for (const sessions of [
    [dashboardFixtureSession("speaking"), dashboardFixtureSession("debate")],
    [{ ...dashboardFixtureSession("debate"), feedback: null }],
  ]) {
    const data = await getDashboardData(
      DASHBOARD_FIXTURE_USER,
      createDashboardFixtureClient({ sources: { recentSessions: sessions } })
        .client,
      options,
    );
    assert.equal(data.recommendedDrill.key, "start-speaking");
    assert.ok(
      data.todayPlanItems.every((item) => item.key !== "underused-track"),
    );
  }
});

test("malformed row values do not produce NaN or fabricate measured zeros", async () => {
  const { client } = createDashboardFixtureClient({
    sources: {
      stats: [{ date: "2026-09-05", sessions_completed: "bad" }],
      recentSessions: [{}],
      scoredSessions: [{}],
    },
  });
  const data = await getDashboardData(DASHBOARD_FIXTURE_USER, client, options);
  assert.equal(data.availability.stats, "unavailable");
  assert.equal(data.availability.recentSessions, "unavailable");
  assert.equal(data.availability.scoredSessions, "unavailable");
  assert.equal(data.availability.recommendation, "unavailable");
});
