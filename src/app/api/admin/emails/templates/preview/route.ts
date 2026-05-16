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
} from "@/lib/email/template-overrides";

export const dynamic = "force-dynamic";

function jsonError(error: unknown) {
  if (error instanceof EmailAdminAuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  const message = error instanceof Error ? error.message : "Unable to preview email template";
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function POST(request: NextRequest) {
  try {
    const context = await requireEmailAdminContext();
    const body = (await request.json()) as Record<string, unknown>;
    const templateKey = resolveEmailTemplateKey(body.templateKey);
    const locale = resolveEmailLocale(body.locale);
    const scenarioKey = typeof body.scenarioKey === "string" ? body.scenarioKey : "default";
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

    return NextResponse.json({
      subject: rendered.subject,
      preheader: rendered.effectiveCopy.preheader,
      html: rendered.html,
      text: rendered.text,
      effectiveCopy: rendered.effectiveCopy,
      activeVersion: activeOverride?.version ?? null,
    });
  } catch (error) {
    return jsonError(error);
  }
}
