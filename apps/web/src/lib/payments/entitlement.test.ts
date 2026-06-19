import assert from "node:assert/strict";
import {
  mapStripeStatus,
  toApplyParams,
  type NormalizedSubscriptionEvent,
} from "./entitlement";

// Stripe status mapping (Lumist parity) + unknown fallback.
assert.equal(mapStripeStatus("active"), "active");
assert.equal(mapStripeStatus("trialing"), "trial");
assert.equal(mapStripeStatus("canceled"), "cancelled");
assert.equal(mapStripeStatus("incomplete"), "pending");
assert.equal(mapStripeStatus("incomplete_expired"), "expired");
assert.equal(mapStripeStatus("past_due"), "past_due");
assert.equal(mapStripeStatus("unpaid"), "expired");
assert.equal(mapStripeStatus("paused"), "expired");
assert.equal(mapStripeStatus("something_new"), "pending");

const start = new Date("2026-06-19T00:00:00Z");
const end = new Date("2026-07-19T00:00:00Z");
const event: NormalizedSubscriptionEvent = {
  userId: "u1",
  provider: "stripe",
  providerSubscriptionId: "sub_1",
  providerCustomerId: "cus_1",
  planType: "premium",
  status: "active",
  currentPeriodStart: start,
  currentPeriodEnd: end,
  trialEndDate: null,
  cancelAtPeriodEnd: false,
  billingCycle: "monthly",
  amountPaid: 25,
  currency: "USD",
  eventAt: start,
};

const params = toApplyParams(event);
assert.equal(params.userId, "u1");
assert.equal(params.providerSubscriptionId, "sub_1");
assert.equal(params.currentPeriodStart, "2026-06-19T00:00:00.000Z");
assert.equal(params.currentPeriodEnd, "2026-07-19T00:00:00.000Z");
assert.equal(params.trialEndDate, null);
assert.equal(params.eventAt, "2026-06-19T00:00:00.000Z");
assert.equal(params.amountPaid, 25);

console.log("payments/entitlement tests passed");
