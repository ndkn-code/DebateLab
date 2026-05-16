import { NextRequest, NextResponse } from "next/server";
import { EmailAdminAuthError, requireEmailAdminContext } from "@/lib/email/admin-template-auth";
import {
  getOverrideForTemplate,
  loadDevEmailTemplateOverrides,
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
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : "Unable to send test email";
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

export async function POST(request: NextRequest) {
  try {
    const context = await requireEmailAdminContext();
    const body = (await request.json()) as Record<string, unknown>;
    const templateKey = resolveEmailTemplateKey(body.templateKey);
    const locale = resolveEmailLocale(body.locale);
    const scenarioKey = typeof body.scenarioKey === "string" ? body.scenarioKey : "default";
    const to = resolveRecipient(body.to);
    const draftFields = body.fields
      ? normalizeEmailTemplateCopy(body.fields, { requireRequiredFields: true })
      : null;
    const overrides = context.supabase
      ? await loadActiveEmailTemplateOverrides(context.supabase)
      : loadDevEmailTemplateOverrides();
    const activeOverride = getOverrideForTemplate(overrides, locale, templateKey);
    const rendered = await renderTemplatePreview({
      templateKey,
      locale,
      scenarioKey,
      activeOverride: activeOverride?.fields ?? null,
      draftFields,
    });
    const data = await sendAdminTemplateTestEmail({ to, templateKey, locale, rendered });

    return NextResponse.json({ id: data?.id ?? null, to, subject: `[Thinkfy QA] ${rendered.subject}` });
  } catch (error) {
    return jsonError(error);
  }
}
