import { NextRequest, NextResponse } from "next/server";

import {
  parseTallySupportIssuePayload,
  verifyTallyWebhookSignature,
} from "@/lib/support/tally-webhook";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 256 * 1024;

function jsonError(message: string, status: number) {
  return NextResponse.json({ ok: false, error: message }, { status });
}

function isSupportedEvent(payload: Record<string, unknown>) {
  return payload.eventType === "FORM_RESPONSE" || payload.eventType === undefined;
}

function hasExpectedFormId(payload: Record<string, unknown>) {
  const expectedFormIds = (
    process.env.TALLY_BUG_REPORT_FORM_IDS ??
    process.env.TALLY_BUG_REPORT_FORM_ID ??
    ""
  )
    .split(",")
    .map((formId) => formId.trim())
    .filter(Boolean);

  if (!expectedFormIds.length) return true;

  const data = payload.data;
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return false;
  }

  return expectedFormIds.includes(String((data as Record<string, unknown>).formId));
}

export async function POST(request: NextRequest) {
  const secret = process.env.TALLY_WEBHOOK_SIGNING_SECRET;
  if (!secret) {
    return jsonError("Missing webhook secret", 500);
  }

  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return jsonError("Webhook payload is too large", 413);
  }

  const rawBody = await request.text();
  if (rawBody.length > MAX_BODY_BYTES) {
    return jsonError("Webhook payload is too large", 413);
  }

  const signature = request.headers.get("tally-signature");
  const isValidSignature = verifyTallyWebhookSignature({
    rawBody,
    signature,
    secret,
  });

  if (!isValidSignature) {
    return jsonError("Invalid webhook signature", 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return jsonError("Invalid JSON payload", 400);
  }

  if (!isSupportedEvent(payload)) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  if (!hasExpectedFormId(payload)) {
    return jsonError("Unexpected Tally form", 400);
  }

  let issueReport;
  try {
    issueReport = parseTallySupportIssuePayload(payload);
  } catch (error) {
    return jsonError(
      error instanceof Error ? error.message : "Invalid Tally payload",
      400
    );
  }

  const admin = createAdminClient();

  const { error } = await admin.from("support_issue_reports").insert(issueReport);
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true });
    }

    return jsonError(error.message, 500);
  }

  return NextResponse.json({ ok: true });
}
