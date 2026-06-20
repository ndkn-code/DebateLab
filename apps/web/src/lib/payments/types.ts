/**
 * Shared payment-domain types + runtime guards (WS-4.1).
 *
 * These are provider-agnostic: provider quirks are normalised into these
 * DebateLab values in TypeScript before any DB write (so the SQL functions just
 * persist). No Supabase types are imported here, so the whole pure layer builds
 * and unit-tests without the regenerated `Database` type.
 */

export const PROVIDERS = ["stripe", "zalopay", "revenuecat", "manual"] as const;
export type Provider = (typeof PROVIDERS)[number];

export const PLAN_TYPES = ["free", "premium", "enterprise"] as const;
export type PlanType = (typeof PLAN_TYPES)[number];

export const SUBSCRIPTION_STATUSES = [
  "active",
  "trial",
  "cancelled",
  "expired",
  "past_due",
  "pending",
] as const;
export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export const BILLING_CYCLES = [
  "monthly",
  "three_months",
  "six_months",
  "yearly",
  "custom",
] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number];

export const TRANSACTION_KINDS = [
  "checkout",
  "activation",
  "renewal",
  "order",
] as const;
export type TransactionKind = (typeof TRANSACTION_KINDS)[number];

/** Result of the `claim_payment_transaction` SQL function. */
export type ClaimResult = "claimed" | "duplicate_done" | "in_flight";

export function isProvider(value: unknown): value is Provider {
  return (
    typeof value === "string" &&
    (PROVIDERS as readonly string[]).includes(value)
  );
}

export function isPlanType(value: unknown): value is PlanType {
  return (
    typeof value === "string" &&
    (PLAN_TYPES as readonly string[]).includes(value)
  );
}

export function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
  return (
    typeof value === "string" &&
    (SUBSCRIPTION_STATUSES as readonly string[]).includes(value)
  );
}

export function isBillingCycle(value: unknown): value is BillingCycle {
  return (
    typeof value === "string" &&
    (BILLING_CYCLES as readonly string[]).includes(value)
  );
}

/** Parameters for the `apply_subscription_from_webhook` RPC (mapped in TS). */
export interface ApplySubscriptionParams {
  userId: string;
  provider: Provider;
  providerSubscriptionId: string | null;
  providerCustomerId: string | null;
  planType: PlanType;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  trialEndDate: string | null;
  cancelAtPeriodEnd: boolean;
  billingCycle: BillingCycle | null;
  amountPaid: number | null;
  currency: string | null;
  /** ISO timestamp used by the out-of-order guard. */
  eventAt: string;
}
