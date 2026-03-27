import { NextResponse } from "next/server";
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
      const redirectTo = isAllowedRedirect(next) ? next : "/dashboard";
      return NextResponse.redirect(`${origin}${redirectTo}`);
    }
  }

  // Auth code exchange failed — redirect to login
  return NextResponse.redirect(`${origin}/auth/login`);
}
