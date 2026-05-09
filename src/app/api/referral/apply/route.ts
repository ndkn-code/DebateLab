import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createReferral, getReferrerByCode } from "@/lib/api/referrals";
import {
  getString,
  readJsonObject,
  RequestValidationError,
} from "@/lib/api/request-validation";
import { consumeRateLimit } from "@/lib/rate-limit";

const REFERRAL_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{6}$/;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await consumeRateLimit(supabase, {
    scope: "referral-apply",
    limit: 20,
    windowSeconds: 60,
  });
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      }
    );
  }

  let code: string;
  try {
    const body = await readJsonObject(request, { maxBytes: 1024 });
    const rawCode = getString(body, "code", {
      required: true,
      minLength: 6,
      maxLength: 6,
    });
    if (!rawCode) throw new RequestValidationError("code is required.");
    code = rawCode.toUpperCase();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid referral code" },
      { status: error instanceof RequestValidationError ? error.status : 400 }
    );
  }

  if (!REFERRAL_CODE_PATTERN.test(code)) {
    return NextResponse.json({ error: "Invalid referral code" }, { status: 400 });
  }

  const referrer = await getReferrerByCode(code);
  if (!referrer) {
    return NextResponse.json(
      { error: "Referral code not found" },
      { status: 404 }
    );
  }

  // Create referral
  const result = await createReferral(referrer.id, user.id);
  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ success: true, referrerName: referrer.display_name });
}
