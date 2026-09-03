"use server";

import { createHash, randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasAdminClientConfig } from "@/lib/supabase/admin";
import {
  getAppBaseUrl,
  isEmailDryRun,
  isEmailSendingEnabled,
} from "@/lib/email/config";
import { sendTransactionalEmail } from "@/lib/email/transactional";
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
  const now = new Date();

  if (input.ageBand === "adult") {
    const { data: status, error } = await supabase.rpc("submit_age_assurance", {
      p_age_band: "adult",
      p_consent_version: "2026-08-30",
    });

    if (error) {
      return {
        ok: false as const,
        error: error.message.includes("AGE_ASSURANCE_LOCKED")
          ? "age_assurance_locked"
          : "save_failed",
      };
    }
    revalidatePath(`/${input.locale}/onboarding`);
    return { ok: true as const, status: status as AgeAssuranceStatus };
  }

  const guardianEmail = input.guardianEmail?.trim().toLowerCase() ?? "";
  if (!hasAdminClientConfig()) {
    return { ok: false as const, error: "consent_service_unavailable" };
  }
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
  const { data: status, error } = await supabase.rpc("submit_age_assurance", {
    p_age_band: "minor",
    p_guardian_email: guardianEmail,
    p_token_hash: tokenHash(token),
    p_expires_at: expiresAt.toISOString(),
    p_consent_version: "2026-08-30",
  });

  if (error) return { ok: false as const, error: "save_failed" };

  const admin = createAdminClient();

  const consentUrl = `${getAppBaseUrl()}/${input.locale}/guardian-consent/${encodeURIComponent(token)}`;
  if (isEmailSendingEnabled() && !isEmailDryRun()) {
    const vi = input.locale === "vi";
    const subject = vi
      ? "Xem xét yêu cầu đồng ý sử dụng Thinkfy"
      : "Review a Thinkfy guardian consent request";
    const text = vi
      ? `Một học sinh đã yêu cầu sự đồng ý của bạn để sử dụng các tính năng luyện tập có xử lý bài viết hoặc giọng nói trên Thinkfy. Xem xét yêu cầu tại: ${consentUrl}. Liên kết hết hạn sau 7 ngày.`
      : `A student asked for your consent to use Thinkfy practice features that process writing or voice data. Review the request at: ${consentUrl}. This link expires in 7 days.`;
    const html = `<p>${vi ? "Một học sinh đã yêu cầu sự đồng ý của bạn để sử dụng các tính năng luyện tập có xử lý bài viết hoặc giọng nói trên Thinkfy." : "A student asked for your consent to use Thinkfy practice features that process writing or voice data."}</p><p><a href="${consentUrl}">${vi ? "Xem xét yêu cầu" : "Review the request"}</a></p><p>${vi ? "Liên kết hết hạn sau 7 ngày." : "This link expires in 7 days."}</p>`;
    const response = await sendTransactionalEmail({
      supabase: admin,
      userId: user.id,
      toEmail: guardianEmail,
      templateKey: "guardian_consent",
      sendKey: `guardian_consent:${user.id}:${tokenHash(token).slice(0, 16)}`,
      locale: input.locale,
      subject,
      text,
      html,
      metadata: {
        guardianConsentUserId: user.id,
        expiresAt: expiresAt.toISOString(),
      },
    });

    if (response.failed) {
      return { ok: false as const, error: "email_failed" };
    }
  }

  revalidatePath(`/${input.locale}/onboarding`);
  return {
    ok: true as const,
    status: status as AgeAssuranceStatus,
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
  const { error } = await admin.rpc("consume_guardian_consent_token", {
    p_token_hash: tokenHash(input.token),
    p_decision: input.decision,
  });

  return error
    ? { ok: false as const, error: "invalid_or_expired" }
    : { ok: true as const, decision: input.decision };
}
