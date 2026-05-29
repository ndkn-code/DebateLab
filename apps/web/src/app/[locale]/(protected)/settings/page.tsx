import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";
import type { SettingsLocale } from "@/lib/settings";
import { SettingsContent } from "@/components/settings/settings-content";
import { DEV_ADMIN_PROFILE } from "@/lib/dev-admin-bypass";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";
import {
  LEADERBOARD_PRIVACY_CONTROLS_ENABLED,
  ORGANIZATION_JOIN_CODES_ENABLED,
} from "@/lib/features";
import {
  getDevOrganizationAffiliation,
  getUserOrganizationAffiliation,
} from "@/lib/organizations/membership";
import {
  getDefaultLeaderboardPrivacySettings,
} from "@/lib/leaderboards/social-trust";
import { getLeaderboardPrivacySettings } from "@/lib/leaderboards/social-trust-server";

export const metadata = {
  title: "Settings",
};

type SettingsPageProps = {
  params: Promise<{ locale: string }>;
};

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { locale } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const devAuthBypassUser = user
    ? null
    : await getDevAuthBypassUserFromServerContext();

  if (!user && !devAuthBypassUser) redirect("/auth/login");

  if (!user && devAuthBypassUser) {
    return (
      <SettingsContent
        profile={DEV_ADMIN_PROFILE as Profile}
        userEmail={devAuthBypassUser.email ?? DEV_ADMIN_PROFILE.email ?? ""}
        currentLocale={locale as SettingsLocale}
        organizationAffiliation={getDevOrganizationAffiliation()}
        organizationJoinCodesEnabled={ORGANIZATION_JOIN_CODES_ENABLED}
        leaderboardPrivacyControlsEnabled={LEADERBOARD_PRIVACY_CONTROLS_ENABLED}
        leaderboardPrivacySettings={getDefaultLeaderboardPrivacySettings({
          userId: DEV_ADMIN_PROFILE.id,
          isStudent: true,
        })}
      />
    );
  }

  const [{ data: profile }, organizationAffiliation, leaderboardPrivacySettings] = await Promise.all([
    supabase
    .from("profiles")
    .select("id, display_name, avatar_url, preferences, orb_balance, referral_code, referred_by")
    .eq("id", user!.id)
      .single(),
    getUserOrganizationAffiliation(supabase, user!.id),
    getLeaderboardPrivacySettings({
      supabase,
      userId: user!.id,
      isStudent: true,
    }),
  ]);

  return (
    <SettingsContent
      profile={profile as Profile | null}
      userEmail={user!.email ?? ""}
      currentLocale={locale as SettingsLocale}
      organizationAffiliation={organizationAffiliation}
      organizationJoinCodesEnabled={ORGANIZATION_JOIN_CODES_ENABLED}
      leaderboardPrivacyControlsEnabled={LEADERBOARD_PRIVACY_CONTROLS_ENABLED}
      leaderboardPrivacySettings={leaderboardPrivacySettings}
    />
  );
}
