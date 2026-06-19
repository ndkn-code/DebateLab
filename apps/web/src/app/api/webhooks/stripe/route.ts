import { NextRequest, NextResponse } from "next/server";
import { createPaymentRepository } from "@/lib/api/payments-repository";
import { verifyStripeSignature } from "@/lib/payments/stripe/client";
import { processStripeEvent } from "@/lib/payments/stripe/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Missing webhook secret" }, { status: 500 });
  }
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const body = await request.text();
  let event;
  try {
    event = verifyStripeSignature(body, signature, secret);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const result = await processStripeEvent(event, createPaymentRepository());
    return NextResponse.json({ received: true, handled: result.handled });
  } catch (error) {
    // 500 → Stripe retries; the insert-first claim makes reprocessing idempotent.
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook processing failed" },
      { status: 500 },
    );
  }
}
