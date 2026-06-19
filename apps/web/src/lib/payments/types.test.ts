import assert from "node:assert/strict";
import {
  isBillingCycle,
  isPlanType,
  isProvider,
  isSubscriptionStatus,
} from "./types";

assert.equal(isProvider("stripe"), true);
assert.equal(isProvider("zalopay"), true);
assert.equal(isProvider("paypal"), false);
assert.equal(isProvider(42), false);
assert.equal(isProvider(null), false);

assert.equal(isPlanType("premium"), true);
assert.equal(isPlanType("free"), true);
assert.equal(isPlanType("platinum"), false);

assert.equal(isSubscriptionStatus("active"), true);
assert.equal(isSubscriptionStatus("past_due"), true);
assert.equal(isSubscriptionStatus("paused"), false);

assert.equal(isBillingCycle("yearly"), true);
assert.equal(isBillingCycle("three_months"), true);
assert.equal(isBillingCycle("biweekly"), false);

console.log("payments/types tests passed");
