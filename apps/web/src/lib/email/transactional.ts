import "server-only";

import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getEmailTestRecipient,
  getReplyToEmailAddresses,
  getSenderEmailAddress,
  isEmailDryRun,
  isEmailStreamEnabled,
} from "@/lib/email/config";
import type { EmailLocale } from "@/lib/email/types";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export async function sendTransactionalEmail(input: {
  supabase: SupabaseClient;
  userId?: string | null;
  toEmail: string;
  templateKey: string;
  sendKey: string;
  locale: EmailLocale;
  subject: string;
  text: string;
  html: string;
  metadata?: Record<string, unknown>;
}) {
  const toEmail = normalizeEmail(input.toEmail);
  const { data: suppressed, error: suppressionError } = await input.supabase
    .from("email_suppressions")
    .select("id")
    .eq("active", true)
    .ilike("email", toEmail)
    .is("category", null)
    .limit(1);
  if (suppressionError) throw new Error(suppressionError.message);
  if (suppressed?.length) {
    return {
      sent: false,
      skipped: true,
      failed: false,
      reason: "active_suppression",
    };
  }

  if (!isEmailStreamEnabled("notifications")) {
    return {
      sent: false,
      skipped: false,
      failed: true,
      reason: "emails_disabled",
    };
  }
  if (isEmailDryRun()) {
    return { sent: false, skipped: true, failed: false, reason: "dry_run" };
  }
  if (!process.env.RESEND_API_KEY) {
    return {
      sent: false,
      skipped: false,
      failed: true,
      reason: "missing_resend_client",
    };
  }

  const from = getSenderEmailAddress("notifications");
  const { data: message, error: insertError } = await input.supabase
    .from("email_messages")
    .insert({
      user_id: input.userId ?? null,
      to_email: toEmail,
      from_email: from,
      reply_to: getReplyToEmailAddresses(),
      template_key: input.templateKey,
      category: "system",
      locale: input.locale,
      subject: input.subject,
      status: "queued",
      send_key: input.sendKey,
      variables: {},
      tags: {
        template: input.templateKey,
        category: "system",
        locale: input.locale,
        stream: "notifications",
      },
      message_class: "transactional",
      sender_stream: "notifications",
      metadata: {
        ...(input.metadata ?? {}),
        messageClass: "transactional",
        senderStream: "notifications",
        notificationTopic: "account_security",
      },
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return {
        sent: false,
        skipped: true,
        failed: false,
        reason: "duplicate_send_key",
      };
    }
    throw new Error(insertError.message);
  }

  const update = async (patch: Record<string, unknown>) => {
    const { error } = await input.supabase
      .from("email_messages")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", message.id);
    if (error) throw new Error(error.message);
  };

  const actualRecipient = getEmailTestRecipient() || toEmail;
  const response = await new Resend(process.env.RESEND_API_KEY).emails.send(
    {
      from,
      to: [actualRecipient],
      replyTo: getReplyToEmailAddresses(),
      subject: input.subject,
      text: input.text,
      html: input.html,
      tags: [
        { name: "template", value: input.templateKey },
        { name: "stream", value: "notifications" },
        { name: "locale", value: input.locale },
      ],
    },
    { idempotencyKey: input.sendKey },
  );

  if (response.error) {
    await update({
      status: "failed",
      error_message: response.error.message,
      failed_at: new Date().toISOString(),
    });
    return {
      sent: false,
      skipped: false,
      failed: true,
      reason: response.error.message,
    };
  }

  await update({
    status: "sent",
    resend_email_id: response.data?.id ?? null,
    sent_at: new Date().toISOString(),
    metadata: {
      ...(input.metadata ?? {}),
      messageClass: "transactional",
      senderStream: "notifications",
      notificationTopic: "account_security",
      intendedRecipient: toEmail,
      actualRecipient,
      testMode: actualRecipient !== toEmail,
    },
  });
  return { sent: true, skipped: false, failed: false, reason: null };
}
