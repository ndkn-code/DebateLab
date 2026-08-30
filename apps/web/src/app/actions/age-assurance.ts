"use server";

import { createHash, randomBytes } from "node:crypto";
import { Resend } from "resend";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasAdminClientConfig } from "@/lib/supabase/admin";
import {
  getAppBaseUrl,
  getReplyToEmailAddresses,
  getSenderEmailAddress,
  isEmailDryRun,
  isEmailSendingEnabled,
} from "@/lib/email/config";
import type { PublicLocale } from "@/lib/public-site";

export type AgeAssuranceStatus =
  | "adult_attested"
  | "guardian_pending"
  | "guardian_granted"
  | "guardian_declined";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function submitAgeAssuranceAction(input: {
  ageBand: "adult" | "minor";
  guardianEmail?: string;
  locale: PublicLocale;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { ok: false as const, error: "not_authenticated" };
  if (!hasAdminClientConfig()) {
    return { ok: false as const, error: "consent_service_unavailable" };
  }

  const admin = createAdminClient();
  const now = new Date();

  if (input.ageBand === "adult") {
    const { error } = await admin.from("user_age_assurance").upsert({
      user_id: user.id,
      age_band: "adult",
      consent_status: "adult_attested",
      consent_version: "2026-08-30",
      guardian_email: null,
      verification_token_hash: null,
      verification_expires_at: null,
      guardian_acted_at: now.toISOString(),
      updated_at: now.toISOString(),
    });

    if (error) return { ok: false as const, error: "save_failed" };
    revalidatePath(`/${input.locale}/onboarding`);
    return { ok: true as const, status: "adult_attested" as const };
  }

  const guardianEmail = input.guardianEmail?.trim().toLowerCase() ?? "";
  if (
    !EMAIL_PATTERN.test(guardianEmail) ||
    guardianEmail === user.email?.toLowerCase()
  ) {
    return { ok: false as const, error: "invalid_guardian_email" };
  }

  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (
    process.env.NODE_ENV === "production" &&
    (!isEmailSendingEnabled() || isEmailDryRun())
  ) {
    return { ok: false as const, error: "consent_service_unavailable" };
  }
  const { error } = await admin.from("user_age_assurance").upsert({
    user_id: user.id,
    age_band: "minor",
    consent_status: "guardian_pending",
    consent_version: "2026-08-30",
    guardian_email: guardianEmail,
    verification_token_hash: tokenHash(token),
    verification_expires_at: expiresAt.toISOString(),
    guardian_acted_at: null,
    updated_at: now.toISOString(),
  });

  if (error) return { ok: false as const, error: "save_failed" };

  const consentUrl = `${getAppBaseUrl()}/${input.locale}/guardian-consent/${encodeURIComponent(token)}`;
  if (isEmailSendingEnabled() && !isEmailDryRun()) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    const vi = input.locale === "vi";
    const response = await resend.emails.send({
      from: getSenderEmailAddress(),
      to: [guardianEmail],
      replyTo: getReplyToEmailAddresses(),
      subject: vi
        ? "Xem xét yêu cầu đồng ý sử dụng Thinkfy"
        : "Review a Thinkfy guardian consent request",
      text: vi
        ? `Một học sinh đã yêu cầu sự đồng ý của bạn để sử dụng các tính năng luyện tập có xử lý bài viết hoặc giọng nói trên Thinkfy. Xem xét yêu cầu tại: ${consentUrl}. Liên kết hết hạn sau 7 ngày.`
        : `A student asked for your consent to use Thinkfy practice features that process writing or voice data. Review the request at: ${consentUrl}. This link expires in 7 days.`,
      html: `<p>${vi ? "Một học sinh đã yêu cầu sự đồng ý của bạn để sử dụng các tính năng luyện tập có xử lý bài viết hoặc giọng nói trên Thinkfy." : "A student asked for your consent to use Thinkfy practice features that process writing or voice data."}</p><p><a href="${consentUrl}">${vi ? "Xem xét yêu cầu" : "Review the request"}</a></p><p>${vi ? "Liên kết hết hạn sau 7 ngày." : "This link expires in 7 days."}</p>`,
    });

    if (response.error) {
      await admin
        .from("user_age_assurance")
        .update({
          consent_status: "guardian_declined",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", user.id);
      return { ok: false as const, error: "email_failed" };
    }
  }

  revalidatePath(`/${input.locale}/onboarding`);
  return {
    ok: true as const,
    status: "guardian_pending" as const,
    previewUrl: process.env.NODE_ENV === "production" ? undefined : consentUrl,
  };
}

export async function recordGuardianDecisionAction(input: {
  token: string;
  decision: "grant" | "decline";
}) {
  if (!hasAdminClientConfig())
    return { ok: false as const, error: "unavailable" };

  const admin = createAdminClient();
  const now = new Date();
  const { data: record, error } = await admin
    .from("user_age_assurance")
    .select("user_id, consent_status, verification_expires_at")
    .eq("verification_token_hash", tokenHash(input.token))
    .maybeSingle();

  if (error || !record) return { ok: false as const, error: "invalid" };
  if (record.consent_status !== "guardian_pending") {
    return { ok: false as const, error: "already_used" };
  }
  if (
    !record.verification_expires_at ||
    new Date(record.verification_expires_at) <= now
  ) {
    return { ok: false as const, error: "expired" };
  }

  const { error: updateError } = await admin
    .from("user_age_assurance")
    .update({
      consent_status:
        input.decision === "grant" ? "guardian_granted" : "guardian_declined",
      guardian_acted_at: now.toISOString(),
      verification_token_hash: null,
      verification_expires_at: null,
      updated_at: now.toISOString(),
    })
    .eq("user_id", record.user_id);

  return updateError
    ? { ok: false as const, error: "save_failed" }
    : { ok: true as const, decision: input.decision };
}
