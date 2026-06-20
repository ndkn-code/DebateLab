import assert from "node:assert/strict";
import { test } from "node:test";
import { FakeRepository } from "../fake-repository";
import { processRevenueCatEvent, type RevenueCatEvent } from "./webhook";

const userId = "00000000-0000-0000-0000-0000000000a1";
const now = new Date("2026-06-19T10:00:00Z");

function evt(over: Partial<RevenueCatEvent> = {}): RevenueCatEvent {
  return {
    id: "rc_evt_1",
    type: "INITIAL_PURCHASE",
    app_user_id: userId,
    original_app_user_id: userId,
    product_id: "yearly",
    purchased_at_ms: Date.parse("2026-06-19T10:00:00Z"),
    ...over,
  };
}

test("payments/revenuecat/webhook scaffold spine", async () => {
  const repo = new FakeRepository([userId]);

  // Purchase from a linked, existing user grants premium.
  const r1 = await processRevenueCatEvent(evt(), repo, { now });
  assert.equal(r1.handled, "INITIAL_PURCHASE");
  assert.equal(r1.granted, true);
  assert.equal(repo.subscriptionCount(), 1);
  // yearly product -> yearly cycle.
  const txn = await repo.getTransaction("revenuecat", "rc_evt_1");
  assert.ok(txn && txn.processed && txn.billingCycle === "yearly");

  // Replay -> deduped.
  const r2 = await processRevenueCatEvent(evt(), repo, { now });
  assert.equal(r2.handled, "duplicate");
  assert.equal(repo.subscriptionCount(), 1);

  // Unlinked app_user_id (anti-spoof: not UUID-shaped / not existing) -> deferred.
  const deferred = await processRevenueCatEvent(
    evt({ id: "rc_evt_2", app_user_id: "$RCAnonymousID:abc", original_app_user_id: undefined }),
    repo,
    { now },
  );
  assert.equal(deferred.handled, "deferred");
  assert.equal(deferred.granted, false);

  // A UUID-shaped but non-existent user is rejected (anti-spoof) -> deferred.
  const spoof = await processRevenueCatEvent(
    evt({ id: "rc_evt_3", app_user_id: "00000000-0000-0000-0000-0000000000ff", original_app_user_id: undefined }),
    repo,
    { now },
  );
  assert.equal(spoof.handled, "deferred");

  // Non-purchase lifecycle event is acknowledged (processed) without granting.
  const cancel = await processRevenueCatEvent(
    evt({ id: "rc_evt_4", type: "CANCELLATION" }),
    repo,
    { now },
  );
  assert.equal(cancel.handled, "CANCELLATION");
  assert.equal(cancel.granted, false);
  assert.equal(await repo.isWebhookProcessed("revenuecat", "rc_evt_4"), true);
});

console.log("payments/revenuecat/webhook tests passed");
