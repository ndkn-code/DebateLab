/**
 * Stripe Checkout session creation (WS-4.1). Resolves the env-held price id for
 * the (market, cycle) and stamps `metadata.userId` onto both the session and the
 * subscription, so the webhook can attribute the resulting subscription.
 */

import type Stripe from "stripe";
import { findPlan, type Market } from "../plans";
import type { BillingCycle } from "../types";
import { getStripeClient } from "./client";

export interface CheckoutInput {
  userId: string;
  billingCycle: BillingCycle;
  market: Market;
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
}

export function resolvePriceId(
  env: Record<string, string | undefined>,
  market: Market,
  billingCycle: BillingCycle,
): string | null {
  const plan = findPlan("premium", billingCycle, market);
  if (!plan) return null;
  return env[plan.stripePriceEnv] ?? null;
}

interface CheckoutDeps {
  client?: Stripe;
  env?: Record<string, string | undefined>;
}

export async function createStripeCheckoutSession(
  input: CheckoutInput,
  deps: CheckoutDeps = {},
): Promise<{ id: string; url: string | null }> {
  const env = deps.env ?? process.env;
  const priceId = resolvePriceId(env, input.market, input.billingCycle);
  if (!priceId) {
    throw new Error(
      `No Stripe price configured for ${input.market}/${input.billingCycle}`,
    );
  }
  const client = deps.client ?? getStripeClient();
  const metadata = {
    userId: input.userId,
    planType: "premium",
    billingCycle: input.billingCycle,
    market: input.market,
  };
  const session = await client.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    customer_email: input.customerEmail,
    metadata,
    subscription_data: { metadata },
  });
  return { id: session.id, url: session.url };
}
