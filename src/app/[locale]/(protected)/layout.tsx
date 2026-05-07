import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProtectedShell } from "./protected-shell";
import { DEV_ADMIN_PROFILE, isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";
import type { Profile } from "@/types/database";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const devAdminBypass = isDevAdminBypassEnabled();

  if (!user) {
    if (devAdminBypass) {
      return (
        <ProtectedShell
          profile={DEV_ADMIN_PROFILE}
          userEmail={DEV_ADMIN_PROFILE.email}
          userId={DEV_ADMIN_PROFILE.id}
        >
          {children}
        </ProtectedShell>
      );
    }

    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, role, onboarding_completed, orb_balance, referral_code, xp, level, selected_title")
    .eq("id", user.id)
    .single();

  // Redirect to onboarding if profile missing or not completed
  if (!profile || !profile.onboarding_completed) {
    if (devAdminBypass) {
      return (
        <ProtectedShell
          profile={DEV_ADMIN_PROFILE}
          userEmail={user.email ?? DEV_ADMIN_PROFILE.email}
          userId={user.id}
        >
          {children}
        </ProtectedShell>
      );
    }

    redirect("/onboarding");
  }

  return (
    <ProtectedShell
      profile={profile as Profile | null}
      userEmail={user.email ?? null}
      userId={user.id}
    >
      {children}
    </ProtectedShell>
  );
}
