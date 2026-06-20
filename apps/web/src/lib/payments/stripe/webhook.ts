/**
 * Stripe webhook orchestration (WS-4.1).
 *
 * Idempotency model (Lumist parity): the subscription STATE is applied on every
 * lifecycle event via `apply_subscription_from_webhook` (idempotent under replay
 * via the out-of-order guard); the activation PAYMENT is recorded once via the
 * insert-first claim. The event ledger is a cheap "already processed" gate +
 * audit. Signature verification happens at the route boundary; this takes the
 * already-verified `Stripe.Event`.
 */

import type Stripe from "stripe";
import { toApplyParams } from "../entitlement";
import { interpretClaim, stripeActivationRef } from "../idempotency";
import { subscriptionEventFromStripe } from "./normalize";
import type { PaymentRepository } from "../repository.types";
import type { NormalizedSubscriptionEvent } from "../entitlement";

export interface StripeWebhookResult {
  received: true;
  handled: string;
  granted: boolean;
}

async function recordActivationReceipt(
  ev: NormalizedSubscriptionEvent,
  stripeSubId: string,
  subscriptionId: string,
  repo: PaymentRepository,
): Promise<void> {
  const ref = stripeActivationRef(stripeSubId);
  const decision = interpretClaim(
    await repo.claimTransaction({
      provider: "stripe",
      idempotencyKey: ref,
      userId: ev.userId,
      kind: "activation",
      amount: ev.amountPaid,
      currency: ev.currency,
      planType: ev.planType,
      billingCycle: ev.billingCycle,
      providerRef: stripeSubId,
    }),
  );
  if (decision.proceed) {
    await repo.finalizeTransaction("stripe", ref, "success", subscriptionId, stripeSubId);
  }
}

async function syncSubscription(
  sub: Stripe.Subscription,
  at: Date,
  repo: PaymentRepository,
  forceStatus?: NormalizedSubscriptionEvent["status"],
): Promise<boolean> {
  const ev = subscriptionEventFromStripe(sub, at);
  if (!ev.userId) return false; // not one of ours (no metadata.userId)
  if (forceStatus) ev.status = forceStatus;
  const subscriptionId = await repo.applySubscription(toApplyParams(ev));
  if (ev.status === "active") {
    await recordActivationReceipt(ev, sub.id, subscriptionId, repo);
  }
  return true;
}

async function dispatch(
  event: Stripe.Event,
  repo: PaymentRepository,
): Promise<StripeWebhookResult> {
  const at = new Date(event.created * 1000);
  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const granted = await syncSubscription(
        event.data.object as Stripe.Subscription,
        at,
        repo,
      );
      return { received: true, handled: event.type, granted };
    }
    case "customer.subscription.deleted": {
      await syncSubscription(
        event.data.object as Stripe.Subscription,
        at,
        repo,
        "cancelled",
      );
      return { received: true, handled: event.type, granted: false };
    }
    default:
      return { received: true, handled: `unhandled:${event.type}`, granted: false };
  }
}

export async function processStripeEvent(
  event: Stripe.Event,
  repo: PaymentRepository,
): Promise<StripeWebhookResult> {
  if (await repo.isWebhookProcessed("stripe", event.id)) {
    return { received: true, handled: "duplicate", granted: false };
  }
  const payload = event as unknown as Record<string, unknown>;
  try {
    const result = await dispatch(event, repo);
    await repo.recordWebhookEvent("stripe", event.id, event.type, payload, null, "processed");
    return result;
  } catch (err) {
    await repo.recordWebhookEvent("stripe", event.id, event.type, payload, null, "error");
    throw err;
  }
}
