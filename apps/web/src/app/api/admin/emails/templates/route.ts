import { NextRequest, NextResponse } from "next/server";
import {
  EmailAdminAuthError,
  assertCanWriteEmailTemplates,
  requireEmailAdminContext,
} from "@/lib/email/admin-template-auth";
import {
  buildEmailTemplateAdminPayload,
  normalizeEmailTemplateCopy,
  resetEmailTemplateOverride,
  resolveEmailLocale,
  resolveEmailTemplateKey,
  saveEmailTemplateOverride,
} from "@/lib/email/template-overrides";

export const dynamic = "force-dynamic";

function jsonError(
  error: unknown,
  fallback = "Unable to manage email templates",
) {
  if (error instanceof EmailAdminAuthError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  }

  const message = error instanceof Error ? error.message : fallback;
  return NextResponse.json({ error: message }, { status: 400 });
}

export async function GET() {
  try {
    const context = await requireEmailAdminContext();
    const payload = await buildEmailTemplateAdminPayload(context.supabase);
    return NextResponse.json(payload);
  } catch (error) {
    return jsonError(error, "Unable to load email templates");
  }
}

export async function PUT(request: NextRequest) {
  try {
    const context = await requireEmailAdminContext();

    const body = (await request.json()) as Record<string, unknown>;
    const templateKey = resolveEmailTemplateKey(body.templateKey);
    const locale = resolveEmailLocale(body.locale);
    const fields = normalizeEmailTemplateCopy(body.fields, {
      requireRequiredFields: true,
    });

    assertCanWriteEmailTemplates(context);

    const override = await saveEmailTemplateOverride({
      supabase: context.supabase,
      templateKey,
      locale,
      fields,
      actorId: context.actorId,
    });
    const payload = await buildEmailTemplateAdminPayload(context.supabase);

    return NextResponse.json({ override, payload });
  } catch (error) {
    return jsonError(error, "Unable to save email template");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const context = await requireEmailAdminContext();

    const body = (await request.json()) as Record<string, unknown>;
    const templateKey = resolveEmailTemplateKey(body.templateKey);
    const locale = resolveEmailLocale(body.locale);

    assertCanWriteEmailTemplates(context);

    const reset = await resetEmailTemplateOverride({
      supabase: context.supabase,
      templateKey,
      locale,
      actorId: context.actorId,
    });
    const payload = await buildEmailTemplateAdminPayload(context.supabase);

    return NextResponse.json({ reset, payload });
  } catch (error) {
    return jsonError(error, "Unable to reset email template");
  }
}
