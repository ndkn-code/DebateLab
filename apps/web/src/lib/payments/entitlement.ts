/**
 * Provider event → DebateLab subscription mapping (WS-4.1).
 *
 * Provider status/plan quirks are normalised to DebateLab values HERE (pure,
 * unit-tested) before calling `apply_subscription_from_webhook`, so the SQL just
 * persists. The canonical access decision stays in `lib/entitlements.ts`.
 */

import type {
  ApplySubscriptionParams,
  BillingCycle,
  PlanType,
  Provider,
  SubscriptionStatus,
} from "./types";

/** Stripe `subscription.status` → DebateLab status (Lumist's mapping). */
const STRIPE_STATUS_MAP: Readonly<Record<string, SubscriptionStatus>> = {
  active: "active",
  trialing: "trial",
  canceled: "cancelled",
  incomplete: "pending",
  incomplete_expired: "expired",
  past_due: "past_due",
  unpaid: "expired",
  paused: "expired",
};

export function mapStripeStatus(stripeStatus: string): SubscriptionStatus {
  return STRIPE_STATUS_MAP[stripeStatus] ?? "pending";
}

/** A provider-normalised subscription event, built by each provider handler. */
export interface NormalizedSubscriptionEvent {
  userId: string;
  provider: Provider;
  providerSubscriptionId: string | null;
  providerCustomerId: string | null;
  planType: PlanType;
  status: SubscriptionStatus;
  currentPeriodStart: Date | null;
  currentPeriodEnd: Date | null;
  trialEndDate: Date | null;
  cancelAtPeriodEnd: boolean;
  billingCycle: BillingCycle | null;
  amountPaid: number | null;
  currency: string | null;
  eventAt: Date;
}

function iso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

export function toApplyParams(
  event: NormalizedSubscriptionEvent,
): ApplySubscriptionParams {
  return {
    userId: event.userId,
    provider: event.provider,
    providerSubscriptionId: event.providerSubscriptionId,
    providerCustomerId: event.providerCustomerId,
    planType: event.planType,
    status: event.status,
    currentPeriodStart: iso(event.currentPeriodStart),
    currentPeriodEnd: iso(event.currentPeriodEnd),
    trialEndDate: iso(event.trialEndDate),
    cancelAtPeriodEnd: event.cancelAtPeriodEnd,
    billingCycle: event.billingCycle,
    amountPaid: event.amountPaid,
    currency: event.currency,
    eventAt: event.eventAt.toISOString(),
  };
}
