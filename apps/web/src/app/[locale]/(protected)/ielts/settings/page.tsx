import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { IeltsSettingsView } from "@/components/ielts/settings/IeltsSettingsView";
import { loadActiveIeltsStudyPlan } from "@/lib/api/ielts/study-plan-repository";
import { goalFromStudyPlanRow } from "@/lib/ielts/onboarding/model";
import {
  buildSettingsDraft,
  type SettingsLocale,
  type SettingsProfilePrivacy,
} from "@/lib/settings";
import { createTypedServerClient } from "@/lib/supabase/server";
import type { Database } from "@/types/supabase";

export const metadata = {
  title: "IELTS settings",
};

export const dynamic = "force-dynamic";

type SettingsPageProps = {
  params: Promise<{ locale: string }>;
};

const PRIVACY_COLUMNS =
  "profile_visibility, analytics_visibility, activities_visibility, achievements_visibility, organization_visibility, allow_connection_requests, searchable_by_handle, friend_code_discovery_enabled";

type TypedClient = SupabaseClient<Database>;

function loadSettingsProfile(client: TypedClient, userId: string) {
  return client
    .from("profiles")
    .select("display_name, avatar_url, handle, profile_status, preferences")
    .eq("id", userId)
    .maybeSingle();
}

function loadSettingsPrivacy(client: TypedClient, userId: string) {
  return client
    .from("profile_privacy_settings")
    .select(PRIVACY_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
}

export default async function IeltsSettingsPage({ params }: SettingsPageProps) {
  const { locale: localeParam } = await params;
  const locale: SettingsLocale = localeParam === "vi" ? "vi" : "en";
  const supabase = await createTypedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const userId = user.id;

  const client = supabase;
  const [activePlan, profileResult, privacyResult] = await Promise.all([
    loadActiveIeltsStudyPlan(userId, client),
    loadSettingsProfile(client, userId),
    loadSettingsPrivacy(client, userId),
  ]);

  const profile = profileResult.data;
  const initialSettings = buildSettingsDraft({
    displayName: profile?.display_name,
    handle: profile?.handle,
    profileStatus: profile?.profile_status,
    avatarUrl: profile?.avatar_url,
    profilePrivacy: privacyResult.data as SettingsProfilePrivacy | null,
    preferences:
      (profile?.preferences as Record<string, unknown> | null | undefined) ??
      {},
    currentLocale: locale,
  });

  return (
    <IeltsSettingsView
      locale={locale}
      goal={activePlan?.plan ? goalFromStudyPlanRow(activePlan.plan) : null}
      initialSettings={initialSettings}
    />
  );
}
