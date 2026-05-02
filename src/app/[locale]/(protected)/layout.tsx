import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProtectedShell } from "./protected-shell";
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

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, role, onboarding_completed, orb_balance, referral_code, xp, level, selected_title")
    .eq("id", user.id)
    .single();

  // Redirect to onboarding if profile missing or not completed
  if (!profile || !profile.onboarding_completed) {
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
