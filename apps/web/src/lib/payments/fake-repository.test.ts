import assert from "node:assert/strict";
import { test } from "node:test";
import { FakeRepository } from "./fake-repository";
import type { ApplySubscriptionParams } from "./types";

function applyParams(
  over: Partial<ApplySubscriptionParams> & {
    userId: string;
    providerSubscriptionId: string | null;
    status: ApplySubscriptionParams["status"];
    eventAt: string;
  },
): ApplySubscriptionParams {
  return {
    provider: "stripe",
    providerCustomerId: "cus_1",
    planType: "premium",
    currentPeriodStart: null,
    currentPeriodEnd: "2026-07-19T00:00:00.000Z",
    trialEndDate: null,
    cancelAtPeriodEnd: false,
    billingCycle: "monthly",
    amountPaid: 25,
    currency: "USD",
    ...over,
  };
}

async function main() {
  const repo = new FakeRepository(["u1"]);

  // ── claim lifecycle ──
  const baseClaim = {
    provider: "stripe" as const,
    idempotencyKey: "sub_a",
    userId: "u1",
    kind: "activation",
    amount: 25,
    currency: "USD",
    planType: "premium",
    billingCycle: "monthly",
    providerRef: "sub_a",
  };
  assert.equal(await repo.claimTransaction(baseClaim), "claimed");
  assert.equal(await repo.claimTransaction(baseClaim), "in_flight");
  await repo.finalizeTransaction("stripe", "sub_a", "success", "sub_1", "sub_a");
  assert.equal(await repo.claimTransaction(baseClaim), "duplicate_done");
  const stored = await repo.getTransaction("stripe", "sub_a");
  assert.ok(stored && stored.processed && stored.status === "success");
  await repo.releaseTransaction("stripe", "sub_a");
  assert.equal(await repo.claimTransaction(baseClaim), "in_flight");
  assert.equal(await repo.getTransaction("stripe", "missing"), null);
  // no-op branches on unknown keys
  await repo.finalizeTransaction("stripe", "missing", "success", null, null);
  await repo.releaseTransaction("stripe", "missing");

  // ── webhook dedup ledger: error is re-processable, processed is terminal ──
  assert.equal(await repo.isWebhookProcessed("stripe", "e1"), false);
  await repo.recordWebhookEvent("stripe", "e1", "t", {}, null, "error");
  assert.equal(await repo.isWebhookProcessed("stripe", "e1"), false);
  await repo.recordWebhookEvent("stripe", "e1", "t", {}, null, "processed");
  assert.equal(await repo.isWebhookProcessed("stripe", "e1"), true);
  assert.equal(repo.webhookStatus("stripe", "e1"), "processed");

  // ── applySubscription: create / update / stale / supersede ──
  const id1 = await repo.applySubscription(
    applyParams({ userId: "u1", providerSubscriptionId: "psub", status: "active", eventAt: "2026-06-19T10:00:00.000Z" }),
  );
  assert.equal(repo.subscriptionCount(), 1);
  assert.equal(repo.subscriptionById(id1)?.status, "active");

  // newer event updates in place + sets endedAt on cancel
  await repo.applySubscription(
    applyParams({ userId: "u1", providerSubscriptionId: "psub", status: "cancelled", eventAt: "2026-06-19T12:00:00.000Z" }),
  );
  assert.equal(repo.subscriptionById(id1)?.status, "cancelled");
  assert.ok(repo.subscriptionById(id1)?.endedAt);
  assert.equal(repo.subscriptionCount(), 1);

  // stale (older) event is dropped
  await repo.applySubscription(
    applyParams({ userId: "u1", providerSubscriptionId: "psub", status: "active", eventAt: "2026-06-19T09:00:00.000Z" }),
  );
  assert.equal(repo.subscriptionById(id1)?.status, "cancelled");

  // supersede-on-activation: a new active sub for u2 expires the prior active one
  const p1 = await repo.applySubscription(
    applyParams({ userId: "u2", providerSubscriptionId: "p1", status: "active", eventAt: "2026-06-19T10:00:00.000Z" }),
  );
  const p2 = await repo.applySubscription(
    applyParams({ userId: "u2", providerSubscriptionId: "p2", status: "active", eventAt: "2026-06-19T11:00:00.000Z" }),
  );
  assert.notEqual(p1, p2);
  assert.equal(repo.subscriptionById(p1)?.status, "expired");
  assert.equal(repo.subscriptionById(p2)?.status, "active");

  // null providerSubscriptionId matches the same null row (ZaloPay shape)
  const z1 = await repo.applySubscription(
    applyParams({ provider: "zalopay", userId: "u3", providerSubscriptionId: null, status: "active", eventAt: "2026-06-19T10:00:00.000Z" }),
  );
  const z2 = await repo.applySubscription(
    applyParams({ provider: "zalopay", userId: "u3", providerSubscriptionId: null, status: "cancelled", eventAt: "2026-06-19T11:00:00.000Z" }),
  );
  assert.equal(z1, z2);

  // ── metering: allow up to limit, deny over, unlimited, window reset ──
  const ps = "2026-06-01T00:00:00.000Z";
  const pe = "2026-07-01T00:00:00.000Z";
  assert.deepEqual(await repo.incrementFeatureUsage("u1", "f", ps, pe, 1, 2), { allowed: true, usedCount: 1, limitCount: 2 });
  assert.deepEqual(await repo.incrementFeatureUsage("u1", "f", ps, pe, 1, 2), { allowed: true, usedCount: 2, limitCount: 2 });
  assert.deepEqual(await repo.incrementFeatureUsage("u1", "f", ps, pe, 1, 2), { allowed: false, usedCount: 2, limitCount: 2 });
  // new period -> fresh window
  assert.deepEqual(await repo.incrementFeatureUsage("u1", "f", pe, "2026-08-01T00:00:00.000Z", 1, 2), { allowed: true, usedCount: 1, limitCount: 2 });
  // unlimited (null) never denies
  assert.equal((await repo.incrementFeatureUsage("u1", "g", ps, pe, 5, null)).allowed, true);

  // ── userExists (anti-spoof) ──
  assert.equal(await repo.userExists("u1"), true);
  assert.equal(await repo.userExists("nobody"), false);

  console.log("payments/fake-repository tests passed");
}

test("payments/fake-repository semantics", main);
