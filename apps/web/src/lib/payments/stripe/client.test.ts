import assert from "node:assert/strict";
import Stripe from "stripe";
import { getStripeClient, verifyStripeSignature } from "./client";

// Missing key throws (empty string is falsy and skips the env default).
assert.throws(() => getStripeClient(""), /STRIPE_SECRET_KEY/);

// Signature verification round-trips with a Stripe-generated test header.
const client = new Stripe("sk_test_dummy");
const secret = "whsec_test_secret";
const payload = JSON.stringify({
  id: "evt_1",
  object: "event",
  type: "customer.subscription.created",
});
const header = client.webhooks.generateTestHeaderString({ payload, secret });
const event = verifyStripeSignature(payload, header, secret, client);
assert.equal(event.id, "evt_1");

// Tampered signature is rejected.
assert.throws(() => verifyStripeSignature(payload, "t=1,v1=bad", secret, client));

// Cached singleton: the first configured client is reused.
const c1 = getStripeClient("sk_test_a");
const c2 = getStripeClient("sk_test_b");
assert.equal(c1, c2);

console.log("payments/stripe/client tests passed");
