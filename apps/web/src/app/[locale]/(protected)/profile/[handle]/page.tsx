import { notFound, redirect } from "next/navigation";

import { SocialProfilePage } from "@/components/profile/social-profile-page";
import { getAnalyticsPageData, normalizeRangePreset } from "@/lib/api/analytics-page";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";
import {
  PROFILE_PUBLIC_READS_ENABLED,
  PROFILE_SOCIAL_ENABLED,
} from "@/lib/features";
import { coercePracticeLanguage } from "@/lib/practice-language";
import { getPublicProfileData } from "@/lib/profile-social/public-profile";
import {
  getProfileAchievementsData,
  getProfileActivityFeedData,
  getProfileAnalyticsTabData,
} from "@/lib/profile-social/tab-data";
import {
  normalizeProfileHandle,
} from "@/lib/profile-social/model";
import { normalizeProfileSocialTab } from "@/lib/profile-social/ui-model";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

interface PublicProfilePageProps {
  params: Promise<{ locale: string; handle: string }>;
  searchParams: Promise<{ range?: string; tab?: string; preview?: string }>;
}

export default async function PublicProfilePage({
  params,
  searchParams,
}: PublicProfilePageProps) {
  const [{ locale, handle }, query] = await Promise.all([params, searchParams]);
  const normalizedHandle = normalizeProfileHandle(handle);

  if (!normalizedHandle || !PROFILE_SOCIAL_ENABLED || !PROFILE_PUBLIC_READS_ENABLED) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const devAuthBypassUser = user
    ? null
    : await getDevAuthBypassUserFromServerContext();

  if (!user && !devAuthBypassUser) {
    redirect("/auth/login");
  }

  const practiceLanguage = coercePracticeLanguage(locale);
  const range = normalizeRangePreset(query.range);
  const activeTab = normalizeProfileSocialTab(query.tab);
  const previewAsPublic = query.preview === "public";
  const publicProfile = await getPublicProfileData({
    handle: normalizedHandle,
    leaderboardLanguage: practiceLanguage,
    previewAsPublic,
  });

  if (publicProfile.state === "not_found") {
    notFound();
  }

  const isSelfProfile = publicProfile.state === "self";
  const targetUserId = publicProfile.profile?.userId ?? null;
  const shouldLoadAnalytics = activeTab === "analytics";
  const shouldLoadActivities = activeTab === "activities";
  const shouldLoadAchievements = activeTab === "achievements";
  const [
    analyticsData,
    publicAnalyticsData,
    activityFeedData,
    achievementsData,
  ] = await Promise.all([
    shouldLoadAnalytics && isSelfProfile && publicProfile.profile
      ? getAnalyticsPageData(publicProfile.profile.userId, range, practiceLanguage)
      : Promise.resolve(null),
    shouldLoadAnalytics && targetUserId && !isSelfProfile
      ? getProfileAnalyticsTabData({
          targetUserId,
          leaderboardLanguage: practiceLanguage,
          range,
          previewAsPublic,
        })
      : Promise.resolve(null),
    shouldLoadActivities && targetUserId
      ? getProfileActivityFeedData({
          targetUserId,
          leaderboardLanguage: practiceLanguage,
          previewAsPublic,
        })
      : Promise.resolve(null),
    shouldLoadAchievements && targetUserId
      ? getProfileAchievementsData({
          targetUserId,
          leaderboardLanguage: practiceLanguage,
          previewAsPublic,
        })
      : Promise.resolve(null),
  ]);

  return (
    <SocialProfilePage
      publicProfile={publicProfile}
      analyticsData={analyticsData}
      publicAnalyticsData={publicAnalyticsData}
      activityFeedData={activityFeedData}
      achievementsData={achievementsData}
      activeTab={activeTab}
      baseHref={
        previewAsPublic
          ? `/profile/${normalizedHandle}?preview=public`
          : `/profile/${normalizedHandle}`
      }
      range={range}
      privacyPreview={previewAsPublic}
    />
  );
}
