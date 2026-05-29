import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { LeaderboardsPage } from "@/components/leaderboards/leaderboards-page";
import { StudentRouteSkeleton } from "@/components/shared/student-route-skeleton";
import { DEV_ADMIN_PROFILE } from "@/lib/dev-admin-bypass";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";
import {
  LEADERBOARD_ANALYTICS_ENABLED,
  LEADERBOARDS_ENABLED,
  LEADERBOARD_SEASON_REPLAY_ENABLED,
  LEADERBOARD_SOCIAL_SIGNALS_ENABLED,
} from "@/lib/features";
import { getLeaderboardPageData } from "@/lib/leaderboards/data";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "Leaderboards",
};

async function LeaderboardsPayload() {
  if (!LEADERBOARDS_ENABLED) {
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

  const activeUserId = user?.id ?? devAuthBypassUser?.id ?? DEV_ADMIN_PROFILE.id;
  const data = await getLeaderboardPageData(activeUserId);

  return (
    <LeaderboardsPage
      data={data}
      viewerUserId={activeUserId}
      seasonReplayEnabled={LEADERBOARD_SEASON_REPLAY_ENABLED}
      socialSignalsEnabled={LEADERBOARD_SOCIAL_SIGNALS_ENABLED}
      analyticsEnabled={LEADERBOARD_ANALYTICS_ENABLED}
    />
  );
}

export default function LeaderboardsRoute() {
  return (
    <Suspense fallback={<StudentRouteSkeleton variant="dashboard" />}>
      <LeaderboardsPayload />
    </Suspense>
  );
}
