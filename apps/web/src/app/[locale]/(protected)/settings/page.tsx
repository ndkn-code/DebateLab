import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";
import {
  ANALYTICS_COOKIE_NAME,
  isAnalyticsEnabled,
  type SettingsLocale,
  type SettingsProfilePrivacy,
} from "@/lib/settings";
import { SettingsContent } from "@/components/settings/settings-content";
import {
  LEADERBOARD_PRIVACY_CONTROLS_ENABLED,
  ORGANIZATION_JOIN_CODES_ENABLED,
} from "@/lib/features";
import { getUserOrganizationAffiliation } from "@/lib/organizations/membership";
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

  if (!user) redirect("/auth/login");

  const [
    { data: profile },
    { data: profilePrivacySettings },
    organizationAffiliation,
    leaderboardPrivacySettings,
    cookieStore,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, display_name, avatar_url, handle, profile_status, preferences, orb_balance, referral_code, referred_by",
      )
      .eq("id", user!.id)
      .single(),
    supabase
      .from("profile_privacy_settings")
      .select(
        "profile_visibility, analytics_visibility, activities_visibility, achievements_visibility, organization_visibility, allow_connection_requests, searchable_by_handle, friend_code_discovery_enabled",
      )
      .eq("user_id", user!.id)
      .maybeSingle(),
    getUserOrganizationAffiliation(supabase, user!.id),
    getLeaderboardPrivacySettings({
      supabase,
      userId: user!.id,
      isStudent: true,
    }),
    cookies(),
  ]);

  const profileWithConsent = profile
    ? {
        ...profile,
        preferences: {
          ...((profile.preferences as Record<string, unknown> | null) ?? {}),
          analytics_cookies_enabled: isAnalyticsEnabled(
            cookieStore.get(ANALYTICS_COOKIE_NAME)?.value,
          ),
        },
      }
    : null;

  return (
    <SettingsContent
      profile={profileWithConsent as Profile | null}
      profilePrivacySettings={
        profilePrivacySettings as SettingsProfilePrivacy | null
      }
      userEmail={user!.email ?? ""}
      currentLocale={locale as SettingsLocale}
      organizationAffiliation={organizationAffiliation}
      organizationJoinCodesEnabled={ORGANIZATION_JOIN_CODES_ENABLED}
      leaderboardPrivacyControlsEnabled={LEADERBOARD_PRIVACY_CONTROLS_ENABLED}
      leaderboardPrivacySettings={leaderboardPrivacySettings}
    />
  );
}
