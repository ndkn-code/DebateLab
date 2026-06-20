/**
 * Stripe object → NormalizedSubscriptionEvent (WS-4.1) — pure mapping, so the
 * webhook orchestration is testable without the Stripe SDK or a live account.
 * Provider-version-variant fields (current_period_* moved onto items in newer
 * API versions) are read defensively, split into small helpers to stay bounded.
 */

import type Stripe from "stripe";
import { fromProviderAmount } from "../currency";
import { mapStripeStatus, type NormalizedSubscriptionEvent } from "../entitlement";
import type { BillingCycle, PlanType } from "../types";

export function billingCycleFromInterval(
  interval: string,
  count: number,
): BillingCycle {
  if (interval === "year") return "yearly";
  if (interval === "month") {
    if (count === 3) return "three_months";
    if (count === 6) return "six_months";
    if (count === 12) return "yearly";
    return "monthly";
  }
  return "custom";
}

interface PeriodCarrier {
  current_period_start?: number;
  current_period_end?: number;
}

function fromUnix(ts: number | null | undefined): Date | null {
  return ts ? new Date(ts * 1000) : null;
}

function firstItem(sub: Stripe.Subscription): Stripe.SubscriptionItem | undefined {
  return sub.items?.data?.[0];
}

function readPeriod(
  sub: Stripe.Subscription,
  item: Stripe.SubscriptionItem | undefined,
  field: keyof PeriodCarrier,
): number | null {
  const onSub = sub as Stripe.Subscription & PeriodCarrier;
  const onItem = item as PeriodCarrier | undefined;
  return onSub[field] ?? onItem?.[field] ?? null;
}

function readCustomerId(sub: Stripe.Subscription): string | null {
  return typeof sub.customer === "string"
    ? sub.customer
    : (sub.customer?.id ?? null);
}

function rawCurrency(
  price: Stripe.Price | undefined,
  sub: Stripe.Subscription,
): string | null {
  return price?.currency ?? sub.currency ?? null;
}

function readCycle(price: Stripe.Price | undefined): BillingCycle | null {
  const recurring = price?.recurring;
  return recurring
    ? billingCycleFromInterval(recurring.interval, recurring.interval_count ?? 1)
    : null;
}

export function subscriptionEventFromStripe(
  sub: Stripe.Subscription,
  eventAt: Date,
  planType: PlanType = "premium",
): NormalizedSubscriptionEvent {
  const item = firstItem(sub);
  const price = item?.price;
  const currency = rawCurrency(price, sub);
  const amount = price?.unit_amount ?? null;
  return {
    userId: sub.metadata?.userId ?? "",
    provider: "stripe",
    providerSubscriptionId: sub.id,
    providerCustomerId: readCustomerId(sub),
    planType,
    status: mapStripeStatus(sub.status),
    currentPeriodStart: fromUnix(readPeriod(sub, item, "current_period_start")),
    currentPeriodEnd: fromUnix(readPeriod(sub, item, "current_period_end")),
    trialEndDate: fromUnix(sub.trial_end),
    cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
    billingCycle: readCycle(price),
    amountPaid:
      amount !== null && currency ? fromProviderAmount(amount, currency) : null,
    currency: currency ? currency.toUpperCase() : null,
    eventAt,
  };
}
