/**
 * Stripe client + signature verification (WS-4.1). The webhook signature is
 * verified at the route boundary via `stripe.webhooks.constructEvent`; `client`
 * is injectable so verification is unit-testable with a generated test header.
 */

import Stripe from "stripe";

let cached: Stripe | null = null;

export function getStripeClient(
  secretKey: string | undefined = process.env.STRIPE_SECRET_KEY,
): Stripe {
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }
  cached ??= new Stripe(secretKey);
  return cached;
}

export function verifyStripeSignature(
  rawBody: string,
  signature: string,
  secret: string,
  client?: Stripe,
): Stripe.Event {
  const stripe = client ?? getStripeClient();
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}
