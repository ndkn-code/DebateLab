import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";
import { SettingsContent } from "@/components/settings/settings-content";

export const metadata = {
  title: "Settings",
};

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, preferences, orb_balance, referral_code, referred_by")
    .eq("id", user.id)
    .single();

  return (
    <SettingsContent
      profile={profile as Profile | null}
      userEmail={user.email ?? ""}
    />
  );
}
