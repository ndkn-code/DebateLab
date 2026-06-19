/**
 * Metered-feature windows + limit resolution (WS-4.1).
 *
 * The atomic increment lives in the `increment_feature_usage` SQL function; this
 * module computes the period window (which becomes `period_start`/`period_end`)
 * and resolves the per-plan cap, both pure and unit-tested.
 */

import { FEATURE_LIMITS, UNLIMITED, type FeatureLimits } from "./plans";
import type { PlanType } from "./types";

export interface UsageWindow {
  start: Date;
  end: Date;
}

export interface MeteredFeature {
  /** Stored in `user_feature_usage.feature_name`. */
  name: string;
  limitKey: keyof FeatureLimits;
  period: "month" | "week";
}

export const METERED_FEATURES = {
  aiWritingScore: { name: "ai_writing_score", limitKey: "aiWritingScoresPerMonth", period: "month" },
  aiSpeakingScore: { name: "ai_speaking_score", limitKey: "aiSpeakingScoresPerMonth", period: "month" },
  fullMockTest: { name: "full_mock_test", limitKey: "fullMockTestsPerMonth", period: "month" },
  bandPrediction: { name: "band_prediction", limitKey: "bandPredictionsPerWeek", period: "week" },
} as const satisfies Record<string, MeteredFeature>;

/** Calendar-month window (UTC). */
export function monthlyWindow(now: Date): UsageWindow {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

/** Monday-anchored week window (UTC). */
export function weeklyWindow(now: Date): UsageWindow {
  const mondayOffset = (now.getUTCDay() + 6) % 7; // 0=Sun -> 6, 1=Mon -> 0
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - mondayOffset),
  );
  const end = new Date(start.getTime());
  end.setUTCDate(end.getUTCDate() + 7);
  return { start, end };
}

export function windowFor(feature: MeteredFeature, now: Date): UsageWindow {
  return feature.period === "week" ? weeklyWindow(now) : monthlyWindow(now);
}

/** Numeric cap for a plan+feature, or `null` when unlimited (no cap enforced). */
export function limitFor(plan: PlanType, feature: MeteredFeature): number | null {
  const value = FEATURE_LIMITS[plan][feature.limitKey];
  if (value === UNLIMITED) return null;
  return typeof value === "number" ? value : null;
}
