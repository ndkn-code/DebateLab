/**
 * Pure idempotency decisions (WS-4.1) — the scar-tissue logic, separated from
 * any DB I/O so it is fully unit-tested for the payments coverage threshold.
 */

import type { ClaimResult } from "./types";

export interface ClaimDecision {
  /** We own the claim — perform the side effects. */
  proceed: boolean;
  /** A prior delivery fully processed this key — no-op success. */
  alreadyDone: boolean;
  /** Another delivery is mid-flight — signal the provider to retry later. */
  retry: boolean;
}

export function interpretClaim(result: ClaimResult): ClaimDecision {
  return {
    proceed: result === "claimed",
    alreadyDone: result === "duplicate_done",
    retry: result === "in_flight",
  };
}

/**
 * Stripe initial-activation idempotency key. The three "first payment" webhook
 * paths (checkout.session.completed, customer.subscription.updated→active,
 * invoice.paid/subscription_create) all converge on this key, so whichever
 * arrives first wins and the others no-op.
 */
export function stripeActivationRef(subscriptionId: string): string {
  return `sub_${subscriptionId}`;
}

/** Stripe renewal idempotency key — invoice-scoped, distinct from activation. */
export function stripeRenewalRef(invoiceId: string): string {
  return `renewal_${invoiceId}`;
}

/**
 * Out-of-order guard: an event strictly older than the last applied event for a
 * subscription is stale and must be dropped (mirrors the SQL guard, exposed here
 * so handlers can short-circuit before touching the DB).
 */
export function isEventStale(eventAt: Date, lastEventAt: Date | null): boolean {
  return lastEventAt !== null && eventAt.getTime() < lastEventAt.getTime();
}
