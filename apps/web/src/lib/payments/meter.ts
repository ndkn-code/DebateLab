/**
 * Meter a feature use (WS-4.1) — resolves the per-plan cap + period window, then
 * delegates to the atomic `increment_feature_usage` via the repository. Returns
 * the usage result so callers can gate (allowed=false → over the cap).
 */

import { limitFor, windowFor, type MeteredFeature } from "./metering";
import type { PaymentRepository, UsageResult } from "./repository.types";
import type { PlanType } from "./types";

export async function meterFeature(
  repo: PaymentRepository,
  userId: string,
  plan: PlanType,
  feature: MeteredFeature,
  now: Date,
  amount = 1,
): Promise<UsageResult> {
  const limit = limitFor(plan, feature);
  const window = windowFor(feature, now);
  return repo.incrementFeatureUsage(
    userId,
    feature.name,
    window.start.toISOString(),
    window.end.toISOString(),
    amount,
    limit,
  );
}
