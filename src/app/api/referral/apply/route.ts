import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createReferral, getReferrerByCode } from "@/lib/api/referrals";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const code = (body.code as string)?.trim().toUpperCase();

  if (!code || code.length !== 6) {
    return NextResponse.json(
      { error: "Invalid referral code" },
      { status: 400 }
    );
  }

  // Find referrer
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
