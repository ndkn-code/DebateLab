import { createHmac, timingSafeEqual } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getEmailOneClickUnsubscribeUrl,
  getEmailUnsubscribeUrl,
} from "@/lib/email/config";
import type { EmailCategory, EmailTemplateKey } from "@/lib/email/types";

export interface EmailUnsubscribePayload {
  email: string;
  userId: string;
  category: EmailCategory;
  templateKey: EmailTemplateKey;
  exp: number;
}

function base64UrlEncode(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function base64UrlDecode(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getSecret() {
  return (
    process.env.EMAIL_UNSUBSCRIBE_SECRET ||
    process.env.RESEND_WEBHOOK_SECRET ||
    process.env.RESEND_API_KEY ||
    "thinkfy-local-email-unsubscribe-secret"
  );
}

function sign(encodedPayload: string) {
  return createHmac("sha256", getSecret()).update(encodedPayload).digest("base64url");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createUnsubscribeToken(
  payload: Omit<EmailUnsubscribePayload, "exp"> & { exp?: number }
) {
  const fullPayload: EmailUnsubscribePayload = {
    ...payload,
    email: payload.email.trim().toLowerCase(),
    exp: payload.exp ?? Math.floor(Date.now() / 1000) + 180 * 24 * 60 * 60,
  };
  const encodedPayload = base64UrlEncode(JSON.stringify(fullPayload));
  return `${encodedPayload}.${sign(encodedPayload)}`;
}

export function verifyUnsubscribeToken(token: string): EmailUnsubscribePayload {
  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature || !safeEqual(signature, sign(encodedPayload))) {
    throw new Error("Invalid unsubscribe token");
  }

  const payload = JSON.parse(base64UrlDecode(encodedPayload)) as EmailUnsubscribePayload;
  if (!payload.email || !payload.userId || !payload.category || !payload.templateKey) {
    throw new Error("Invalid unsubscribe payload");
  }

  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("Expired unsubscribe token");
  }

  return {
    ...payload,
    email: payload.email.trim().toLowerCase(),
  };
}

export function buildUnsubscribeLinks(
  payload: Omit<EmailUnsubscribePayload, "exp"> & { exp?: number }
) {
  const token = createUnsubscribeToken(payload);
  return {
    token,
    unsubscribeUrl: getEmailUnsubscribeUrl(token),
    oneClickUnsubscribeUrl: getEmailOneClickUnsubscribeUrl(token),
  };
}

export function buildListUnsubscribeHeaders(oneClickUrl: string, supportEmail: string) {
  return {
    "List-Unsubscribe": `<${oneClickUrl}>, <mailto:${supportEmail}?subject=Unsubscribe>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}

export async function applyEmailUnsubscribe(input: {
  supabase: SupabaseClient;
  payload: EmailUnsubscribePayload;
  source: string;
}) {
  const email = input.payload.email.trim().toLowerCase();
  const { data: existingRows, error: selectError } = await input.supabase
    .from("email_suppressions")
    .select("id")
    .eq("active", true)
    .ilike("email", email)
    .or(`category.is.null,category.eq.${input.payload.category}`)
    .limit(1);

  if (selectError) throw new Error(selectError.message);
  const existing = existingRows?.[0];

  const patch = {
    email,
    category: input.payload.category,
    reason: "unsubscribe",
    source: input.source,
    active: true,
    metadata: {
      userId: input.payload.userId,
      category: input.payload.category,
      templateKey: input.payload.templateKey,
    },
    updated_at: new Date().toISOString(),
  };

  if (existing?.id) {
    const { error } = await input.supabase
      .from("email_suppressions")
      .update(patch)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await input.supabase.from("email_suppressions").insert(patch);
  if (error) throw new Error(error.message);
}
