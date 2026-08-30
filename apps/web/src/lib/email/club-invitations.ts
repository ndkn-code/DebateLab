import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getEmailTestRecipient,
  getReplyToEmailAddresses,
  getSenderEmailAddress,
  isEmailDryRun,
  isEmailStreamEnabled,
} from "@/lib/email/config";
import {
  applyEmailTemplateCopyOverrides,
  getOverrideForTemplate,
  loadActiveEmailTemplateOverrides,
} from "@/lib/email/template-overrides";
import {
  buildTemplateVariables,
  renderThinkfyEmail,
} from "@/lib/email/templates";
import type { EmailLocale, EmailTemplateVariables } from "@/lib/email/types";
import { normalizeOrganizationRole } from "@/lib/organizations/compatibility";

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
  const canonicalRole = normalizeOrganizationRole(role, "student") ?? "student";
  if (locale === "vi") {
    if (canonicalRole === "owner") return "quản trị viên CLB";
    if (canonicalRole === "admin") return "quản trị viên tổ chức";
    if (canonicalRole === "teacher") return "giáo viên";
    return "thành viên";
  }

  if (canonicalRole === "owner") return "club admin";
  if (canonicalRole === "admin") return "organization admin";
  if (canonicalRole === "teacher") return "teacher";
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
  patch: Record<string, unknown>,
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
  const canonicalRole = normalizeOrganizationRole(input.role, "student") ?? "student";
  const baseVariables = buildClubInvitationVariables({
    locale,
    inviteUrl: input.inviteUrl,
    clubName: input.clubName,
    role: canonicalRole,
    inviterName: input.inviterName,
    city: input.city,
  });
  const overrides = await loadActiveEmailTemplateOverrides(input.supabase);
  const variables = applyEmailTemplateCopyOverrides(
    baseVariables,
    getOverrideForTemplate(overrides, locale, templateKey)?.fields,
  );
  const sendKey =
    input.sendKey ??
    `club_invitation:${input.invitationId}:${normalizeEmail(input.toEmail)}`;
  const metadata = {
    clubId: input.clubId,
    invitationId: input.invitationId,
    role: input.role,
    inviteUrl: input.inviteUrl,
  };

  if (await hasActiveSuppression(input.supabase, input.toEmail)) {
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
      skipped: true,
      failed: false,
      reason: "emails_disabled",
    };
  }

  if (isEmailDryRun()) {
    return { sent: false, skipped: true, failed: false, reason: "dry_run" };
  }

  const { data: message, error: insertError } = await input.supabase
    .from("email_messages")
    .insert({
      user_id: input.invitedUserId ?? null,
      to_email: normalizeEmail(input.toEmail),
      from_email: getSenderEmailAddress("notifications"),
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
        stream: "notifications",
      },
      message_class: "operational",
      sender_stream: "notifications",
      metadata: {
        ...metadata,
        messageClass: "operational",
        notificationTopic: "club_invitation",
        senderStream: "notifications",
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

  const resend = getResendClient();
  if (!resend) {
    await updateEmailMessage(input.supabase, message.id as string, {
      status: "failed",
      error_message: "Resend client is not configured.",
      failed_at: new Date().toISOString(),
    });
    return {
      sent: false,
      skipped: false,
      failed: true,
      reason: "missing_resend_client",
    };
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
        from: getSenderEmailAddress("notifications"),
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
      { idempotencyKey: sendKey },
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
    const messageText =
      error instanceof Error ? error.message : "Unknown send failure";
    await updateEmailMessage(input.supabase, message.id as string, {
      status: "failed",
      error_message: messageText,
      failed_at: new Date().toISOString(),
    });
    return { sent: false, skipped: false, failed: true, reason: messageText };
  }
}
