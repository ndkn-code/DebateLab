import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const { origin } = new URL(request.url);

  // Validate referral code exists
  const supabase = await createClient();
  const { data: referrer } = await supabase
    .from("profiles")
    .select("id, display_name")
    .eq("referral_code", code.toUpperCase())
    .single();

  if (!referrer) {
    // Invalid code — redirect to login without setting cookie
    return NextResponse.redirect(`${origin}/auth/login`);
  }

  // Set referral cookie (survives OAuth redirect flow)
  const response = NextResponse.redirect(`${origin}/auth/login?ref=${code.toUpperCase()}`);
  response.cookies.set("ref_code", code.toUpperCase(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });

  return response;
}
