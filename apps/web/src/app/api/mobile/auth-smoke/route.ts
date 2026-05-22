import { NextResponse, type NextRequest } from "next/server";

import { requireRequestAuth } from "@/lib/api/request-auth";

export async function GET(request: NextRequest) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return auth.errorResponse;

  const { data: profile } = await auth.supabase
    .from("profiles")
    .select("id, display_name, onboarding_completed")
    .eq("id", auth.user.id)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    authSource: auth.authSource,
    user: {
      id: auth.user.id,
      email: auth.user.email ?? null,
    },
    profile: profile
      ? {
          id: profile.id as string,
          displayName: (profile.display_name as string | null) ?? null,
          onboardingCompleted:
            (profile.onboarding_completed as boolean | null) ?? null,
        }
      : null,
  });
}
