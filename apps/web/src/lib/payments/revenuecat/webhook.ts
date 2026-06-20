/**
 * RevenueCat webhook orchestration (WS-4.1, SCAFFOLD).
 *
 * Implements the shared spine — anti-spoof app_user_id → user resolution, defer
 * when unlinked, event dedup, and purchase → apply-first grant. The full product
 * catalog, alias reconciliation, and price capture are finished when mobile IAP
 * ships. Auth (Authorization secret) is checked at the route via
 * `isAuthorizedRevenueCat`. Per Lumist, lifecycle events (cancellation/expiry)
 * are NOT real-time — expiry is driven by `current_period_end`.
 */

import { addMonths } from "../dates";
import { toApplyParams, type NormalizedSubscriptionEvent } from "../entitlement";
import { grantSubscription } from "../grant";
import { cycleMonths } from "../plans";
import type { BillingCycle } from "../types";
import type { PaymentRepository } from "../repository.types";
import { candidateUserIds } from "./mapping";

export interface RevenueCatEvent {
  id: string;
  type: string;
  app_user_id?: string;
  original_app_user_id?: string;
  product_id?: string;
  store?: string;
  purchased_at_ms?: number;
  expiration_at_ms?: number;
}

export interface RevenueCatResult {
  handled: string;
  granted: boolean;
}

const PURCHASE_TYPES: ReadonlySet<string> = new Set([
  "INITIAL_PURCHASE",
  "NON_RENEWING_PURCHASE",
  "RENEWAL",
  "PRODUCT_CHANGE",
]);

const PRODUCT_CYCLE: Readonly<Record<string, BillingCycle>> = {
  monthly: "monthly",
  "3months": "three_months",
  three_month: "three_months",
  three_months: "three_months",
  yearly: "yearly",
  "12months": "yearly",
};

function cycleForProduct(productId: string | undefined): BillingCycle {
  return (productId && PRODUCT_CYCLE[productId]) || "monthly";
}

async function resolveUser(
  event: RevenueCatEvent,
  repo: PaymentRepository,
): Promise<string | null> {
  for (const id of candidateUserIds(event.app_user_id, event.original_app_user_id)) {
    if (await repo.userExists(id)) return id;
  }
  return null;
}

async function grantPurchase(
  event: RevenueCatEvent,
  userId: string,
  repo: PaymentRepository,
  now: Date,
): Promise<boolean> {
  const billingCycle = cycleForProduct(event.product_id);
  const start = event.purchased_at_ms ? new Date(event.purchased_at_ms) : now;
  const end = event.expiration_at_ms
    ? new Date(event.expiration_at_ms)
    : addMonths(start, cycleMonths(billingCycle));
  const ev: NormalizedSubscriptionEvent = {
    userId,
    provider: "revenuecat",
    providerSubscriptionId: event.original_app_user_id ?? userId,
    providerCustomerId: event.app_user_id ?? null,
    planType: "premium",
    status: "active",
    currentPeriodStart: start,
    currentPeriodEnd: end,
    trialEndDate: null,
    cancelAtPeriodEnd: false,
    billingCycle,
    amountPaid: null,
    currency: null,
    eventAt: now,
  };
  const result = await grantSubscription(
    repo,
    {
      provider: "revenuecat",
      idempotencyKey: event.id,
      userId,
      kind: "activation",
      amount: null,
      currency: null,
      planType: "premium",
      billingCycle,
      providerRef: event.product_id ?? null,
    },
    toApplyParams(ev),
  );
  return result.granted;
}

export async function processRevenueCatEvent(
  event: RevenueCatEvent,
  repo: PaymentRepository,
  deps: { now?: Date } = {},
): Promise<RevenueCatResult> {
  const userId = await resolveUser(event, repo);
  if (!userId) {
    return { handled: "deferred", granted: false }; // not linked to a user yet
  }
  if (await repo.isWebhookProcessed("revenuecat", event.id)) {
    return { handled: "duplicate", granted: false };
  }
  const payload = event as unknown as Record<string, unknown>;
  try {
    const granted = PURCHASE_TYPES.has(event.type)
      ? await grantPurchase(event, userId, repo, deps.now ?? new Date())
      : false;
    await repo.recordWebhookEvent("revenuecat", event.id, event.type, payload, userId, "processed");
    return { handled: event.type, granted };
  } catch (err) {
    await repo.recordWebhookEvent("revenuecat", event.id, event.type, payload, userId, "error");
    throw err;
  }
}
