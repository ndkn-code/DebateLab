import { redirect } from "next/navigation";
import type { SupabaseClient } from "@supabase/supabase-js";
import { IeltsSettingsView } from "@/components/ielts/settings/IeltsSettingsView";
import { DEV_ADMIN_PROFILE } from "@/lib/dev-admin-bypass";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";
import { loadActiveIeltsStudyPlan } from "@/lib/api/ielts/study-plan-repository";
import { goalFromStudyPlanRow } from "@/lib/ielts/onboarding/model";
import {
  buildSettingsDraft,
  type SettingsLocale,
  type SettingsProfilePrivacy,
} from "@/lib/settings";
import { createTypedAdminClient } from "@/lib/supabase/admin";
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

function loadSettingsProfile(
  client: TypedClient,
  userId: string,
  isDevBypass: boolean,
) {
  if (isDevBypass) {
    return Promise.resolve({ data: DEV_ADMIN_PROFILE, error: null });
  }
  return client
    .from("profiles")
    .select("display_name, avatar_url, handle, profile_status, preferences")
    .eq("id", userId)
    .maybeSingle();
}

function loadSettingsPrivacy(
  client: TypedClient,
  userId: string,
  isDevBypass: boolean,
) {
  if (isDevBypass) return Promise.resolve({ data: null, error: null });
  return client
    .from("profile_privacy_settings")
    .select(PRIVACY_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
}

// Authenticated and dev-preview reads deliberately stay in one route boundary.
// eslint-disable-next-line complexity
export default async function IeltsSettingsPage({ params }: SettingsPageProps) {
  const { locale: localeParam } = await params;
  const locale: SettingsLocale = localeParam === "vi" ? "vi" : "en";
  const supabase = await createTypedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const devAuthBypassUser = user
    ? null
    : await getDevAuthBypassUserFromServerContext();

  if (!user && !devAuthBypassUser) redirect("/auth/login");

  const userId = user?.id ?? devAuthBypassUser?.id;
  if (!userId) redirect("/auth/login");

  const client = devAuthBypassUser ? createTypedAdminClient() : supabase;
  const [activePlan, profileResult, privacyResult] = await Promise.all([
    loadActiveIeltsStudyPlan(userId, client),
    loadSettingsProfile(client, userId, Boolean(devAuthBypassUser)),
    loadSettingsPrivacy(client, userId, Boolean(devAuthBypassUser)),
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
