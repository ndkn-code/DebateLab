import assert from "node:assert/strict";
import type Stripe from "stripe";
import {
  billingCycleFromInterval,
  subscriptionEventFromStripe,
} from "./normalize";

assert.equal(billingCycleFromInterval("year", 1), "yearly");
assert.equal(billingCycleFromInterval("month", 1), "monthly");
assert.equal(billingCycleFromInterval("month", 3), "three_months");
assert.equal(billingCycleFromInterval("month", 6), "six_months");
assert.equal(billingCycleFromInterval("month", 12), "yearly");
assert.equal(billingCycleFromInterval("week", 1), "custom");

function fakeSub(over: Record<string, unknown> = {}): Stripe.Subscription {
  return {
    id: "sub_123",
    status: "active",
    customer: "cus_1",
    cancel_at_period_end: false,
    trial_end: null,
    current_period_start: 1_750_000_000,
    current_period_end: 1_752_592_000,
    currency: "usd",
    metadata: { userId: "u1" },
    items: {
      data: [
        { price: { unit_amount: 2500, currency: "usd", recurring: { interval: "month", interval_count: 1 } } },
      ],
    },
    ...over,
  } as unknown as Stripe.Subscription;
}

const at = new Date("2026-06-19T10:00:00Z");
const ev = subscriptionEventFromStripe(fakeSub(), at);
assert.equal(ev.userId, "u1");
assert.equal(ev.provider, "stripe");
assert.equal(ev.providerSubscriptionId, "sub_123");
assert.equal(ev.providerCustomerId, "cus_1");
assert.equal(ev.status, "active");
assert.equal(ev.billingCycle, "monthly");
assert.equal(ev.amountPaid, 25); // 2500 USD minor units -> 25.00
assert.equal(ev.currency, "USD");
assert.equal(ev.currentPeriodEnd?.toISOString(), new Date(1_752_592_000 * 1000).toISOString());
assert.equal(ev.eventAt, at);

// VND (zero-decimal) is not divided by 100.
const vnd = subscriptionEventFromStripe(
  fakeSub({
    currency: "vnd",
    items: { data: [{ price: { unit_amount: 197000, currency: "vnd", recurring: { interval: "month", interval_count: 1 } } }] },
  }),
  at,
);
assert.equal(vnd.amountPaid, 197000);
assert.equal(vnd.currency, "VND");

// Missing metadata.userId -> empty (handler treats as "not ours").
assert.equal(subscriptionEventFromStripe(fakeSub({ metadata: {} }), at).userId, "");

// trialing maps to trial; expanded customer object resolves to its id.
const trial = subscriptionEventFromStripe(
  fakeSub({ status: "trialing", trial_end: 1_752_000_000, customer: { id: "cus_obj" } }),
  at,
);
assert.equal(trial.status, "trial");
assert.equal(trial.providerCustomerId, "cus_obj");
assert.ok(trial.trialEndDate);

console.log("payments/stripe/normalize tests passed");
