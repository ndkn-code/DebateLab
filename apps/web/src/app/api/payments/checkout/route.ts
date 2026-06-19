import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseInput } from "@/lib/api/boundary";
import { requireRequestAuth } from "@/lib/api/request-auth";
import {
  readJsonObject,
  RequestValidationError,
} from "@/lib/api/request-validation";
import { findPlan } from "@/lib/payments/plans";
import { createStripeCheckoutSession } from "@/lib/payments/stripe/checkout";
import { createZaloPayOrder } from "@/lib/payments/zalopay/order";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CheckoutSchema = z.object({
  method: z.enum(["stripe", "zalopay"]),
  billingCycle: z.enum(["monthly", "three_months", "yearly"]),
  market: z.enum(["vn", "global"]),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
  returnUrl: z.string().url().optional(),
});

export async function POST(request: NextRequest) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return auth.errorResponse;

  try {
    const input = parseInput(CheckoutSchema, await readJsonObject(request));

    if (input.method === "stripe") {
      if (!input.successUrl || !input.cancelUrl) {
        return NextResponse.json(
          { error: "successUrl and cancelUrl are required for Stripe" },
          { status: 400 },
        );
      }
      const session = await createStripeCheckoutSession({
        userId: auth.user.id,
        billingCycle: input.billingCycle,
        market: input.market,
        successUrl: input.successUrl,
        cancelUrl: input.cancelUrl,
        customerEmail: auth.user.email ?? undefined,
      });
      return NextResponse.json({ url: session.url, sessionId: session.id });
    }

    // ZaloPay (VN only).
    if (!input.returnUrl) {
      return NextResponse.json(
        { error: "returnUrl is required for ZaloPay" },
        { status: 400 },
      );
    }
    const plan = findPlan("premium", input.billingCycle, "vn");
    if (!plan) {
      return NextResponse.json({ error: "No matching plan" }, { status: 400 });
    }
    const order = await createZaloPayOrder({
      userId: auth.user.id,
      billingCycle: input.billingCycle,
      amount: plan.amountMajor,
      returnUrl: input.returnUrl,
    });
    return NextResponse.json({ url: order.orderUrl, appTransId: order.appTransId });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Checkout failed" },
      { status: 500 },
    );
  }
}
