import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getEmailTestRecipient,
  getReplyToEmailAddresses,
  getSenderEmailAddress,
  isEmailDryRun,
  isEmailSendingEnabled,
} from "@/lib/email/config";
import {
  applyEmailTemplateCopyOverrides,
  getOverrideForTemplate,
  loadActiveEmailTemplateOverrides,
} from "@/lib/email/template-overrides";
import { buildTemplateVariables, renderThinkfyEmail } from "@/lib/email/templates";
import type { EmailLocale, EmailTemplateVariables } from "@/lib/email/types";

let resendClient: Resend | null = null;

function getResendClient() {
  if (!process.env.RESEND_API_KEY) return null;
  resendClient ??= new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function roleLabel(role: string, locale: EmailLocale) {
  if (locale === "vi") {
    if (role === "owner") return "quản trị viên CLB";
    if (role === "coach") return "huấn luyện viên";
    return "thành viên";
  }

  if (role === "owner") return "club admin";
  if (role === "coach") return "coach";
  return "member";
}

async function hasActiveSuppression(supabase: SupabaseClient, email: string) {
  const { data, error } = await supabase
    .from("email_suppressions")
    .select("id")
    .eq("active", true)
    .ilike("email", normalizeEmail(email))
    .or("category.is.null,category.eq.system")
    .limit(1);

  if (error && !["42P01", "PGRST205"].includes(error.code ?? "")) {
    throw new Error(error.message);
  }

  return Boolean(data?.length);
}

async function updateEmailMessage(
  supabase: SupabaseClient,
  id: string,
  patch: Record<string, unknown>
) {
  const { error } = await supabase
    .from("email_messages")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) throw new Error(error.message);
}

export function buildClubInvitationVariables(input: {
  recipientName?: string | null;
  locale?: EmailLocale;
  inviteUrl: string;
  clubName: string;
  role: string;
  inviterName?: string | null;
  city?: string | null;
}) {
  const locale = input.locale ?? "vi";
  return buildTemplateVariables("club_invitation", {
    locale,
    userName: input.recipientName || (locale === "en" ? "there" : "bạn"),
    ctaUrl: input.inviteUrl,
    clubName: input.clubName,
    clubRole: roleLabel(input.role, locale),
    inviterName: input.inviterName,
    city: input.city,
  });
}

export async function sendClubInvitationEmail(input: {
  supabase: SupabaseClient;
  invitationId: string;
  toEmail: string;
  invitedUserId?: string | null;
  clubName: string;
  clubId: string;
  role: string;
  inviterName?: string | null;
  city?: string | null;
  inviteUrl: string;
  sendKey?: string;
  locale?: EmailLocale;
}) {
  const locale = input.locale ?? "vi";
  const templateKey = "club_invitation";
  const baseVariables = buildClubInvitationVariables({
    locale,
    inviteUrl: input.inviteUrl,
    clubName: input.clubName,
    role: input.role,
    inviterName: input.inviterName,
    city: input.city,
  });
  const overrides = await loadActiveEmailTemplateOverrides(input.supabase);
  const variables = applyEmailTemplateCopyOverrides(
    baseVariables,
    getOverrideForTemplate(overrides, locale, templateKey)?.fields
  );
  const sendKey = input.sendKey ?? `club_invitation:${input.invitationId}:${normalizeEmail(input.toEmail)}`;
  const metadata = {
    clubId: input.clubId,
    invitationId: input.invitationId,
    role: input.role,
    inviteUrl: input.inviteUrl,
  };

  if (await hasActiveSuppression(input.supabase, input.toEmail)) {
    return { sent: false, skipped: true, failed: false, reason: "active_suppression" };
  }

  const { data: message, error: insertError } = await input.supabase
    .from("email_messages")
    .insert({
      user_id: input.invitedUserId ?? null,
      to_email: normalizeEmail(input.toEmail),
      from_email: getSenderEmailAddress(),
      reply_to: getReplyToEmailAddresses(),
      template_key: templateKey,
      category: "system",
      locale,
      subject: variables.subject,
      status: "queued",
      send_key: sendKey,
      variables: variables as EmailTemplateVariables,
      tags: {
        template: templateKey,
        category: "system",
        locale,
      },
      metadata,
    })
    .select("id")
    .single();

  if (insertError) {
    if (insertError.code === "23505") {
      return { sent: false, skipped: true, failed: false, reason: "duplicate_send_key" };
    }
    throw new Error(insertError.message);
  }

  if (!isEmailSendingEnabled()) {
    await updateEmailMessage(input.supabase, message.id as string, {
      status: "skipped",
      skip_reason: "emails_disabled",
    });
    return { sent: false, skipped: true, failed: false, reason: "emails_disabled" };
  }

  if (isEmailDryRun()) {
    await updateEmailMessage(input.supabase, message.id as string, {
      status: "skipped",
      skip_reason: "dry_run",
    });
    return { sent: false, skipped: true, failed: false, reason: "dry_run" };
  }

  const resend = getResendClient();
  if (!resend) {
    await updateEmailMessage(input.supabase, message.id as string, {
      status: "failed",
      error_message: "Resend client is not configured.",
      failed_at: new Date().toISOString(),
    });
    return { sent: false, skipped: false, failed: true, reason: "missing_resend_client" };
  }

  try {
    const rendered = await renderThinkfyEmail({
      subject: variables.subject,
      variables,
    });
    const testRecipient = getEmailTestRecipient();
    const actualRecipient = testRecipient || input.toEmail;
    const response = await resend.emails.send(
      {
        from: getSenderEmailAddress(),
        to: [actualRecipient],
        replyTo: getReplyToEmailAddresses(),
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        tags: [
          { name: "template", value: templateKey },
          { name: "category", value: "system" },
          { name: "locale", value: locale },
        ],
      },
      { idempotencyKey: sendKey }
    );

    if (response.error) throw new Error(response.error.message);

    await updateEmailMessage(input.supabase, message.id as string, {
      status: "sent",
      resend_email_id: response.data?.id ?? null,
      sent_at: new Date().toISOString(),
      metadata: {
        ...metadata,
        actualRecipient,
        intendedRecipient: input.toEmail,
        testMode: Boolean(testRecipient),
      },
    });

    return { sent: true, skipped: false, failed: false, reason: null };
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Unknown send failure";
    await updateEmailMessage(input.supabase, message.id as string, {
      status: "failed",
      error_message: messageText,
      failed_at: new Date().toISOString(),
    });
    return { sent: false, skipped: false, failed: true, reason: messageText };
  }
}
