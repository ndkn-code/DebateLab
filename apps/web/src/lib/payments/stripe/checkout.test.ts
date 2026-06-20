import assert from "node:assert/strict";
import { test } from "node:test";
import type Stripe from "stripe";
import { createStripeCheckoutSession, resolvePriceId } from "./checkout";

const env = {
  NEXT_PUBLIC_STRIPE_PRICE_MONTHLY_VN: "price_vn_monthly",
  NEXT_PUBLIC_STRIPE_PRICE_MONTHLY: "price_global_monthly",
};

assert.equal(resolvePriceId(env, "vn", "monthly"), "price_vn_monthly");
assert.equal(resolvePriceId(env, "global", "monthly"), "price_global_monthly");
assert.equal(resolvePriceId(env, "vn", "yearly"), null); // env var not set
assert.equal(resolvePriceId({}, "global", "monthly"), null);

test("payments/stripe/checkout session create", async () => {
  const calls: Stripe.Checkout.SessionCreateParams[] = [];
  const client = {
    checkout: {
      sessions: {
        create: async (params: Stripe.Checkout.SessionCreateParams) => {
          calls.push(params);
          return { id: "cs_1", url: "https://checkout" };
        },
      },
    },
  } as unknown as Stripe;

  const res = await createStripeCheckoutSession(
    { userId: "u1", billingCycle: "monthly", market: "vn", successUrl: "https://ok", cancelUrl: "https://no" },
    { client, env },
  );
  assert.equal(res.id, "cs_1");
  assert.equal(res.url, "https://checkout");
  const created = calls[0];
  assert.ok(created);
  assert.equal(created.mode, "subscription");
  assert.equal(created.line_items?.[0]?.price, "price_vn_monthly");
  assert.equal(created.metadata?.userId, "u1");
  assert.equal(created.subscription_data?.metadata?.userId, "u1");

  await assert.rejects(
    () =>
      createStripeCheckoutSession(
        { userId: "u1", billingCycle: "yearly", market: "vn", successUrl: "a", cancelUrl: "b" },
        { client, env },
      ),
    /No Stripe price configured/,
  );
});

console.log("payments/stripe/checkout tests passed");
