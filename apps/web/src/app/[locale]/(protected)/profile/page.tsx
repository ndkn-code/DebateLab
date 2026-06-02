import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";
import { getAnalyticsPageData, normalizeRangePreset } from "@/lib/api/analytics-page";
import { coercePracticeLanguage } from "@/lib/practice-language";
import { AnalyticsPage } from "@/components/analytics/analytics-page";
import { SocialProfilePage } from "@/components/profile/social-profile-page";
import {
  PROFILE_PUBLIC_READS_ENABLED,
  PROFILE_SOCIAL_ENABLED,
} from "@/lib/features";
import { getPublicProfileData } from "@/lib/profile-social/public-profile";
import {
  getProfileAchievementsData,
  getProfileActivityFeedData,
  getProfileAnalyticsTabData,
} from "@/lib/profile-social/tab-data";
import { normalizeProfileSocialTab } from "@/lib/profile-social/ui-model";

export const metadata = { title: "Profile — Thinkfy" };
export const dynamic = "force-dynamic";

interface ProfilePageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ range?: string; tab?: string; preview?: string }>;
}

export default async function ProfilePage({ params, searchParams }: ProfilePageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const range = normalizeRangePreset(query.range);
  const practiceLanguage = coercePracticeLanguage(locale);
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

  if (PROFILE_SOCIAL_ENABLED && PROFILE_PUBLIC_READS_ENABLED) {
    const previewAsPublic = query.preview === "public";
    const publicProfile = await getPublicProfileData({
      leaderboardLanguage: practiceLanguage,
      previewAsPublic,
    });
    const activeTab = normalizeProfileSocialTab(query.tab);
    const targetUserId = publicProfile.profile?.userId ?? null;
    const isSelfProfile = publicProfile.state === "self";
    const [
      analyticsData,
      publicAnalyticsData,
      activityFeedData,
      achievementsData,
    ] = await Promise.all([
      isSelfProfile && publicProfile.profile
        ? getAnalyticsPageData(publicProfile.profile.userId, range, practiceLanguage)
        : Promise.resolve(null),
      targetUserId && !isSelfProfile
        ? getProfileAnalyticsTabData({
            targetUserId,
            leaderboardLanguage: practiceLanguage,
            range,
            previewAsPublic,
          })
        : Promise.resolve(null),
      targetUserId
        ? getProfileActivityFeedData({
            targetUserId,
            leaderboardLanguage: practiceLanguage,
            previewAsPublic,
          })
        : Promise.resolve(null),
      targetUserId
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
        baseHref={previewAsPublic ? "/profile?preview=public" : "/profile"}
        range={range}
        privacyPreview={previewAsPublic}
      />
    );
  }

  const data = await getAnalyticsPageData(
    user?.id ?? devAuthBypassUser!.id,
    range,
    practiceLanguage
  );

  return <AnalyticsPage data={data} />;
}
