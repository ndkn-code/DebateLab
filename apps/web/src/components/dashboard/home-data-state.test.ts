import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createDashboardFixtureClient,
  dashboardFixtureSession,
  DASHBOARD_FIXTURE_NOW,
  DASHBOARD_FIXTURE_USER,
} from "@/lib/api/__fixtures__/dashboard";
import { getDashboardData } from "@/lib/api/dashboard";
import { getHomeDataState, retainHomeData } from "./home-data-state";

const load = (
  fixture: Parameters<typeof createDashboardFixtureClient>[0] = {},
) =>
  getDashboardData(
    DASHBOARD_FIXTURE_USER,
    createDashboardFixtureClient(fixture).client,
    { now: DASHBOARD_FIXTURE_NOW, timezone: "UTC" },
  );

test("all-failed initial snapshot does not present profile, goals, scores or activity as measured", async () => {
  const data = await load({
    failures: [
      "profile",
      "enrollments",
      "recentSessions",
      "scoredSessions",
      "stats",
      "activityLog",
    ],
  });
  const state = getHomeDataState(data);
  assert.deepEqual(state, {
    profile: false,
    activity: false,
    activityPartial: false,
    goals: false,
    skills: false,
    history: false,
    streak: false,
    retryable: true,
  });
});

test("known panels and recommendation survive a failed retry with explicit retained state", async () => {
  const good = await load({
    sources: { recentSessions: [dashboardFixtureSession("speaking")] },
  });
  const failed = await load({
    failures: [
      "profile",
      "enrollments",
      "recentSessions",
      "scoredSessions",
      "stats",
      "activityLog",
    ],
  });
  const result = retainHomeData(good, failed);
  assert.equal(result.retained, true);
  assert.deepEqual(result.data.recommendedDrill, good.recommendedDrill);
  assert.deepEqual(result.data.profile, good.profile);
  assert.deepEqual(result.data.hero, good.hero);
  assert.deepEqual(result.data.recentActivity, good.recentActivity);
  // Retention is a presentation snapshot; the incoming read still drives Retry.
  assert.equal(getHomeDataState(failed).retryable, true);
  assert.equal(failed.availability.profile, "unavailable");
  const restored = await load({
    sources: { recentSessions: [dashboardFixtureSession("debate")] },
  });
  const retry = retainHomeData(result.data, restored);
  assert.equal(retry.retained, false);
  assert.equal(retry.data.recommendedDrill.track, "speaking");
  assert.equal(getHomeDataState(retry.data).retryable, false);
});

test("partial activity remains visible as a lower bound, with goals unavailable", async () => {
  const data = await load({
    sources: { recentSessions: [dashboardFixtureSession("speaking")] },
    failures: ["stats"],
  });
  const state = getHomeDataState(data);
  assert.equal(state.activity, true);
  assert.equal(state.activityPartial, true);
  assert.equal(state.goals, false);
  assert.equal(state.history, true);
  assert.equal(state.profile, true);
  assert.equal(state.retryable, true);
});

test("partial known activity survives a failed retry, then yields to complete recovered data", async () => {
  const partial = await load({
    sources: { recentSessions: [dashboardFixtureSession("speaking")] },
    failures: ["stats", "activityLog"],
  });
  const failed = await load({
    failures: [
      "profile",
      "enrollments",
      "recentSessions",
      "scoredSessions",
      "stats",
      "activityLog",
    ],
  });
  const kept = retainHomeData(partial, failed);
  assert.equal(kept.retained, true);
  assert.equal(getHomeDataState(kept.data).activityPartial, true);
  assert.equal(getHomeDataState(kept.data).goals, false);
  assert.deepEqual(kept.data.hero.weeklyStats, partial.hero.weeklyStats);
  const recovered = await load();
  const final = retainHomeData(kept.data, recovered);
  assert.equal(final.retained, false);
  assert.equal(getHomeDataState(final.data).goals, true);
  assert.deepEqual(final.data.hero.weeklyStats, recovered.hero.weeklyStats);
});
