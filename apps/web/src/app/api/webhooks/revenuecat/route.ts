import { NextRequest, NextResponse } from "next/server";
import { createPaymentRepository } from "@/lib/api/payments-repository";
import { isAuthorizedRevenueCat } from "@/lib/payments/revenuecat/auth";
import {
  processRevenueCatEvent,
  type RevenueCatEvent,
} from "@/lib/payments/revenuecat/webhook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const secret = process.env.REVENUECAT_WEBHOOK_AUTH_KEY;
  if (!isAuthorizedRevenueCat(request.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { event?: RevenueCatEvent };
  try {
    body = (await request.json()) as { event?: RevenueCatEvent };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const event = body.event;
  if (!event?.id || !event?.type) {
    return NextResponse.json({ error: "Missing event" }, { status: 400 });
  }

  try {
    const result = await processRevenueCatEvent(event, createPaymentRepository());
    if (result.handled === "deferred") {
      // Not yet linked to a user — ask RevenueCat to retry later.
      return NextResponse.json({ deferred: true }, { status: 503 });
    }
    return NextResponse.json({ received: true, handled: result.handled });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Webhook failed" },
      { status: 500 },
    );
  }
}
