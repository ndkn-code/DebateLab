import { NextRequest, NextResponse } from "next/server";
import { Webhook, WebhookVerificationError } from "svix";
import {
  buildProviderStatusPatch,
  getResendEmailId,
  getResendEventType,
  getResendRecipientEmail,
  getSuppressionReason,
  isSuppressionEvent,
} from "@/lib/email/webhooks";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function svixHeaders(request: NextRequest) {
  return {
    "svix-id": request.headers.get("svix-id") ?? "",
    "svix-timestamp": request.headers.get("svix-timestamp") ?? "",
    "svix-signature": request.headers.get("svix-signature") ?? "",
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Missing webhook secret" }, { status: 500 });
  }

  const body = await request.text();
  let payload: Record<string, unknown>;

  try {
    payload = new Webhook(secret).verify(body, svixHeaders(request)) as Record<string, unknown>;
  } catch (error) {
    const status = error instanceof WebhookVerificationError ? 400 : 500;
    return NextResponse.json({ error: "Invalid webhook signature" }, { status });
  }

  const svixId = request.headers.get("svix-id");
  if (!svixId) {
    return NextResponse.json({ error: "Missing svix-id" }, { status: 400 });
  }

  const eventType = getResendEventType(payload);
  const resendEmailId = getResendEmailId(payload);
  const admin = createAdminClient();

  try {
    const { data: message } = resendEmailId
      ? await admin
          .from("email_messages")
          .select("id, status, to_email")
          .eq("resend_email_id", resendEmailId)
          .maybeSingle()
      : { data: null };

    const { error: insertError } = await admin.from("email_webhook_events").insert({
      svix_id: svixId,
      event_type: eventType,
      resend_email_id: resendEmailId,
      email_message_id: message?.id ?? null,
      payload,
      processed_at: new Date().toISOString(),
    });

    if (insertError) {
      if (insertError.code === "23505") {
        return NextResponse.json({ ok: true, duplicate: true });
      }

      throw new Error(insertError.message);
    }

    if (message?.id) {
      const { patch } = buildProviderStatusPatch({
        eventType,
        currentStatus: message.status,
      });

      const { error: updateError } = await admin
        .from("email_messages")
        .update(patch)
        .eq("id", message.id);

      if (updateError) throw new Error(updateError.message);
    }

    if (isSuppressionEvent(eventType)) {
      const email = getResendRecipientEmail(payload) || message?.to_email;
      if (email) {
        const normalizedEmail = normalizeEmail(email);
        const { data: existingRows } = await admin
          .from("email_suppressions")
          .select("id")
          .eq("active", true)
          .ilike("email", normalizedEmail)
          .is("category", null)
          .limit(1);
        const existing = existingRows?.[0];

        const suppressionPatch = {
          email: normalizedEmail,
          category: null,
          reason: getSuppressionReason(eventType),
          source: "resend_webhook",
          active: true,
          metadata: {
            eventType,
            resendEmailId,
            svixId,
          },
          updated_at: new Date().toISOString(),
        };

        if (existing?.id) {
          await admin
            .from("email_suppressions")
            .update(suppressionPatch)
            .eq("id", existing.id);
        } else {
          await admin.from("email_suppressions").insert(suppressionPatch);
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    await admin.from("email_webhook_events").upsert(
      {
        svix_id: svixId,
        event_type: eventType,
        resend_email_id: resendEmailId,
        payload,
        error_message: error instanceof Error ? error.message : "Webhook processing failed",
      },
      { onConflict: "svix_id" }
    );

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Webhook processing failed",
      },
      { status: 500 }
    );
  }
}
