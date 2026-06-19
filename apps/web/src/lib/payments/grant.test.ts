import assert from "node:assert/strict";
import { test } from "node:test";
import { FakeRepository } from "./fake-repository";
import { grantSubscription } from "./grant";
import type { ClaimTransactionInput } from "./repository.types";
import type { ApplySubscriptionParams } from "./types";

const claim: ClaimTransactionInput = {
  provider: "zalopay",
  idempotencyKey: "260619_000001",
  userId: "u1",
  kind: "order",
  amount: 197000,
  currency: "VND",
  planType: "premium",
  billingCycle: "monthly",
  providerRef: "zp_1",
};

const params: ApplySubscriptionParams = {
  userId: "u1",
  provider: "zalopay",
  providerSubscriptionId: null,
  providerCustomerId: null,
  planType: "premium",
  status: "active",
  currentPeriodStart: "2026-06-19T00:00:00.000Z",
  currentPeriodEnd: "2026-07-19T00:00:00.000Z",
  trialEndDate: null,
  cancelAtPeriodEnd: false,
  billingCycle: "monthly",
  amountPaid: 197000,
  currency: "VND",
  eventAt: "2026-06-19T10:00:00.000Z",
};

test("payments/grant apply-first idempotent grant", async () => {
  // First delivery: applies entitlement + records the receipt.
  const repo = new FakeRepository();
  const r1 = await grantSubscription(repo, claim, params);
  assert.equal(r1.granted, true);
  assert.equal(r1.alreadyProcessed, false);
  assert.ok(r1.subscriptionId);
  assert.equal(repo.subscriptionCount(), 1);
  const txn = await repo.getTransaction("zalopay", "260619_000001");
  assert.ok(txn && txn.processed && txn.status === "success");

  // Replay: entitlement re-applied to the SAME row, receipt not double-recorded.
  const r2 = await grantSubscription(repo, claim, params);
  assert.equal(r2.granted, false);
  assert.equal(r2.alreadyProcessed, true);
  assert.equal(r2.subscriptionId, r1.subscriptionId);
  assert.equal(repo.subscriptionCount(), 1);

  // Concurrent delivery (a pending claim already exists): entitlement still
  // applied, receipt skipped because the other delivery owns it.
  const repo2 = new FakeRepository();
  await repo2.claimTransaction(claim);
  const r3 = await grantSubscription(repo2, claim, params);
  assert.equal(r3.granted, false);
  assert.equal(r3.alreadyProcessed, false);
  assert.equal(repo2.subscriptionCount(), 1);
});

console.log("payments/grant tests passed");
