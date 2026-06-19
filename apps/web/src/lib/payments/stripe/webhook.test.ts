import assert from "node:assert/strict";
import { test } from "node:test";
import type Stripe from "stripe";
import { FakeRepository } from "../fake-repository";
import { stripeActivationRef } from "../idempotency";
import { processStripeEvent } from "./webhook";

function sub(id: string, status: string, userId: string | null): Stripe.Subscription {
  return {
    id,
    status,
    customer: "cus_1",
    cancel_at_period_end: false,
    trial_end: null,
    current_period_start: 1_750_000_000,
    current_period_end: 1_752_592_000,
    currency: "usd",
    metadata: userId ? { userId } : {},
    items: { data: [{ price: { unit_amount: 2500, currency: "usd", recurring: { interval: "month", interval_count: 1 } } }] },
  } as unknown as Stripe.Subscription;
}

function evt(id: string, type: string, createdSec: number, object: unknown): Stripe.Event {
  return { id, type, created: createdSec, data: { object } } as unknown as Stripe.Event;
}

test("payments/stripe/webhook idempotency + out-of-order", async () => {
  const repo = new FakeRepository(["u1"]);

  // Activation grants + records the receipt once.
  const created = evt("evt_a", "customer.subscription.created", 1000, sub("sub_1", "active", "u1"));
  const r1 = await processStripeEvent(created, repo);
  assert.equal(r1.granted, true);
  assert.equal(repo.subscriptionCount(), 1);
  const txn = await repo.getTransaction("stripe", stripeActivationRef("sub_1"));
  assert.ok(txn && txn.processed);
  assert.equal(await repo.isWebhookProcessed("stripe", "evt_a"), true);

  // Replay of the same event id -> deduped, no second subscription.
  const r2 = await processStripeEvent(created, repo);
  assert.equal(r2.handled, "duplicate");
  assert.equal(repo.subscriptionCount(), 1);

  // Stale (older) cancel for the same subscription is dropped (status stays active).
  const subId = txn!.subscriptionId ?? "";
  await processStripeEvent(
    evt("evt_b", "customer.subscription.updated", 500, sub("sub_1", "canceled", "u1")),
    repo,
  );
  assert.equal(repo.subscriptionById(subId)?.status, "active");

  // Newer cancel applies.
  await processStripeEvent(
    evt("evt_c", "customer.subscription.updated", 2000, sub("sub_1", "canceled", "u1")),
    repo,
  );
  assert.equal(repo.subscriptionById(subId)?.status, "cancelled");

  // A subscription without our metadata.userId is not granted.
  const foreign = await processStripeEvent(
    evt("evt_d", "customer.subscription.created", 3000, sub("sub_2", "active", null)),
    repo,
  );
  assert.equal(foreign.granted, false);
  assert.equal(repo.subscriptionCount(), 1);

  // Deleted maps to cancelled (no grant).
  const del = await processStripeEvent(
    evt("evt_e", "customer.subscription.deleted", 4000, sub("sub_3", "active", "u1")),
    repo,
  );
  assert.equal(del.handled, "customer.subscription.deleted");
  assert.equal(del.granted, false);

  // Unhandled event types are acknowledged, not errored.
  const other = await processStripeEvent(
    evt("evt_f", "invoice.payment_failed", 5000, {}),
    repo,
  );
  assert.equal(other.handled, "unhandled:invoice.payment_failed");
});

console.log("payments/stripe/webhook tests passed");
