/**
 * Thinkfy IELTS plan catalog + metered feature limits (WS-4.1).
 *
 * Prices are code-owned (single source of truth), not in the DB — mirroring
 * Lumist. Stripe price ids live in env (resolved by name here). FEATURE_LIMITS
 * is retuned for IELTS (freemium + metered AI grading, YouPass-style caps).
 */

import type { BillingCycle, PlanType } from "./types";

export type Market = "vn" | "global";
export const UNLIMITED = "unlimited" as const;
export type Unlimited = typeof UNLIMITED;

export interface FeatureLimits {
  aiWritingScoresPerMonth: number | Unlimited;
  aiSpeakingScoresPerMonth: number | Unlimited;
  fullMockTestsPerMonth: number | Unlimited;
  bandPredictionsPerWeek: number | Unlimited;
  pronunciationReports: boolean;
  studyPlan: boolean;
}

export const FEATURE_LIMITS: Record<PlanType, FeatureLimits> = {
  free: {
    aiWritingScoresPerMonth: 3,
    aiSpeakingScoresPerMonth: 3,
    fullMockTestsPerMonth: 1,
    bandPredictionsPerWeek: 1,
    pronunciationReports: false,
    studyPlan: false,
  },
  premium: {
    aiWritingScoresPerMonth: UNLIMITED,
    aiSpeakingScoresPerMonth: UNLIMITED,
    fullMockTestsPerMonth: UNLIMITED,
    bandPredictionsPerWeek: UNLIMITED,
    pronunciationReports: true,
    studyPlan: true,
  },
  enterprise: {
    aiWritingScoresPerMonth: UNLIMITED,
    aiSpeakingScoresPerMonth: UNLIMITED,
    fullMockTestsPerMonth: UNLIMITED,
    bandPredictionsPerWeek: UNLIMITED,
    pronunciationReports: true,
    studyPlan: true,
  },
};

export interface PlanPrice {
  planType: PlanType;
  billingCycle: BillingCycle;
  market: Market;
  /** Display amount in major units (VND whole-dong / USD dollars). */
  amountMajor: number;
  currency: string;
  /** Name of the env var holding this plan's Stripe price id. */
  stripePriceEnv: string;
}

export const PLAN_CATALOG: readonly PlanPrice[] = [
  { planType: "premium", billingCycle: "monthly", market: "vn", amountMajor: 197000, currency: "VND", stripePriceEnv: "NEXT_PUBLIC_STRIPE_PRICE_MONTHLY_VN" },
  { planType: "premium", billingCycle: "three_months", market: "vn", amountMajor: 447000, currency: "VND", stripePriceEnv: "NEXT_PUBLIC_STRIPE_PRICE_3MONTHS_VN" },
  { planType: "premium", billingCycle: "yearly", market: "vn", amountMajor: 1188000, currency: "VND", stripePriceEnv: "NEXT_PUBLIC_STRIPE_PRICE_12MONTHS_VN" },
  { planType: "premium", billingCycle: "monthly", market: "global", amountMajor: 25, currency: "USD", stripePriceEnv: "NEXT_PUBLIC_STRIPE_PRICE_MONTHLY" },
  { planType: "premium", billingCycle: "three_months", market: "global", amountMajor: 60, currency: "USD", stripePriceEnv: "NEXT_PUBLIC_STRIPE_PRICE_3MONTHS" },
  { planType: "premium", billingCycle: "yearly", market: "global", amountMajor: 144, currency: "USD", stripePriceEnv: "NEXT_PUBLIC_STRIPE_PRICE_12MONTHS" },
];

export function findPlan(
  planType: PlanType,
  billingCycle: BillingCycle,
  market: Market,
): PlanPrice | undefined {
  return PLAN_CATALOG.find(
    (p) =>
      p.planType === planType &&
      p.billingCycle === billingCycle &&
      p.market === market,
  );
}

export function marketFromCurrency(currency: string): Market {
  return currency.toUpperCase() === "VND" ? "vn" : "global";
}

/** Months covered by a billing cycle (fixed-term period math). */
export function cycleMonths(cycle: BillingCycle): number {
  switch (cycle) {
    case "monthly":
      return 1;
    case "three_months":
      return 3;
    case "six_months":
      return 6;
    case "yearly":
      return 12;
    default:
      return 1;
  }
}
