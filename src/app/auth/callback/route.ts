import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

const ALLOWED_REDIRECT_PREFIXES = [
  "/dashboard",
  "/onboarding",
  "/courses",
  "/settings",
  "/profile",
  "/practice",
  "/chat",
  "/history",
];

function isAllowedRedirect(path: string): boolean {
  // Must start with / and not // (prevents protocol-relative URLs)
  if (!path.startsWith("/") || path.startsWith("//")) return false;
  return ALLOWED_REDIRECT_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Handle referral linking after successful auth
      await linkReferralIfPresent(supabase);

      const redirectTo = isAllowedRedirect(next) ? next : "/dashboard";
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  // Auth code exchange failed — redirect to login
  return NextResponse.redirect(`${origin}/auth/login`);
}

async function linkReferralIfPresent(
  supabase: Awaited<ReturnType<typeof createClient>>
) {
  try {
    const cookieStore = await cookies();
    const refCode = cookieStore.get("ref_code")?.value;
    if (!refCode) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Find referrer by code
    const { data: referrer } = await supabase
      .from("profiles")
      .select("id")
      .eq("referral_code", refCode.toUpperCase())
      .single();

    if (!referrer || referrer.id === user.id) return;

    // Check if referee already has a referral
    const { data: existing } = await supabase
      .from("referrals")
      .select("id")
      .eq("referee_id", user.id)
      .maybeSingle();

    if (existing) return;

    // Create referral with pending status
    await supabase.from("referrals").insert({
      referrer_id: referrer.id,
      referee_id: user.id,
    });

    // Update referred_by on profile
    await supabase
      .from("profiles")
      .update({ referred_by: referrer.id })
      .eq("id", user.id);
  } catch {
    // Non-critical — don't block auth flow
  }
}
