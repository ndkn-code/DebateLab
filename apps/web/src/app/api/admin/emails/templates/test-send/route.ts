import { NextRequest, NextResponse } from "next/server";
import {
  EmailAdminAuthError,
  requireEmailAdminContext,
  type EmailAdminRequestContext,
} from "@/lib/email/admin-template-auth";
import {
  getOverrideForTemplate,
  loadActiveEmailTemplateOverrides,
  normalizeEmailTemplateCopy,
  renderTemplatePreview,
  resolveEmailLocale,
  resolveEmailTemplateKey,
  sendAdminTemplateTestEmail,
} from "@/lib/email/template-overrides";

export const dynamic = "force-dynamic";

function jsonError(error: unknown) {
  if (error instanceof EmailAdminAuthError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }

  const message =
    error instanceof Error ? error.message : "Unable to send test email";
  return NextResponse.json({ error: message }, { status: 400 });
}

function resolveRecipient(value: unknown) {
  const recipient =
    typeof value === "string" && value.trim()
      ? value.trim()
      : process.env.EMAIL_TEST_RECIPIENT || "ndkn.work@gmail.com";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
    throw new Error("Enter a valid test recipient email.");
  }

  return recipient;
}

async function assertRecipientIsNotGloballySuppressed(
  context: EmailAdminRequestContext,
  email: string,
) {
  if (!context.supabase) return;

  const { data, error } = await context.supabase
    .from("email_suppressions")
    .select("id")
    .eq("active", true)
    .ilike("email", email.trim().toLowerCase())
    .is("category", null)
    .limit(1);

  if (error) throw new Error(error.message);
  if (data?.length) {
    throw new EmailAdminAuthError(
      "This recipient is globally suppressed from email.",
      409,
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireEmailAdminContext();
    const body = (await request.json()) as Record<string, unknown>;
    const templateKey = resolveEmailTemplateKey(body.templateKey);
    const locale = resolveEmailLocale(body.locale);
    const scenarioKey =
      typeof body.scenarioKey === "string" ? body.scenarioKey : "default";
    const to = resolveRecipient(body.to);
    await assertRecipientIsNotGloballySuppressed(context, to);
    const draftFields = body.fields
      ? normalizeEmailTemplateCopy(body.fields, { requireRequiredFields: true })
      : null;
    const overrides = await loadActiveEmailTemplateOverrides(context.supabase);
    const activeOverride = getOverrideForTemplate(
      overrides,
      locale,
      templateKey,
    );
    const rendered = await renderTemplatePreview({
      templateKey,
      locale,
      scenarioKey,
      activeOverride: activeOverride?.fields ?? null,
      draftFields,
    });
    const data = await sendAdminTemplateTestEmail({
      to,
      templateKey,
      locale,
      rendered,
    });

    return NextResponse.json({
      id: data?.id ?? null,
      to,
      subject: `[Thinkfy QA] ${rendered.subject}`,
    });
  } catch (error) {
    return jsonError(error);
  }
}
