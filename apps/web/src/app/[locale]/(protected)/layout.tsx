import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProtectedShell } from "./protected-shell";
import { LocalizedAppProviders } from "../localized-app-providers";
import { DEV_ADMIN_PROFILE, isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";
import { LEADERBOARD_SEASON_REPLAY_ENABLED } from "@/lib/features";
import { getLeaderboardPageData } from "@/lib/leaderboards/data";
import { coerceLeaderboardLanguage } from "@/lib/leaderboards/model";
import type {
  LeaderboardLanguage,
  LeaderboardSeasonOutcome,
} from "@/lib/leaderboards/types";
import type { Profile } from "@/types/database";

export const dynamic = "force-dynamic";

async function getShellSeasonReplayOutcome(
  userId: string,
  leaderboardLanguage: LeaderboardLanguage
): Promise<LeaderboardSeasonOutcome | null> {
  if (!LEADERBOARD_SEASON_REPLAY_ENABLED) {
    return null;
  }

  try {
    const data = await getLeaderboardPageData(userId, {
      dataSource: "ledger",
      leaderboardLanguage,
    });

    if (data.status === "unavailable") {
      return null;
    }

    return data.personal.outcome ?? null;
  } catch {
    return null;
  }
}

export default async function ProtectedLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const leaderboardLanguage = coerceLeaderboardLanguage(locale);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const devAdminBypass = isDevAdminBypassEnabled();
  const devAuthBypassUser = user
    ? null
    : await getDevAuthBypassUserFromServerContext();

  if (!user) {
    if (devAdminBypass || devAuthBypassUser) {
      return (
        <LocalizedAppProviders>
          <ProtectedShell
            profile={DEV_ADMIN_PROFILE}
            userEmail={devAuthBypassUser?.email ?? DEV_ADMIN_PROFILE.email}
            userId={devAuthBypassUser?.id ?? DEV_ADMIN_PROFILE.id}
            seasonReplayEnabled={false}
          >
            {children}
          </ProtectedShell>
        </LocalizedAppProviders>
      );
    }

    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, display_name, avatar_url, handle, profile_status, role, onboarding_completed, preferences, orb_balance, referral_code, xp, level, selected_title")
    .eq("id", user.id)
    .single();
  const seasonReplayOutcome = await getShellSeasonReplayOutcome(
    user.id,
    leaderboardLanguage
  );

  // Redirect to onboarding if profile missing or not completed
  if (!profile || !profile.onboarding_completed) {
    if (devAdminBypass) {
      return (
        <LocalizedAppProviders>
          <ProtectedShell
            profile={DEV_ADMIN_PROFILE}
            userEmail={user.email ?? DEV_ADMIN_PROFILE.email}
            userId={user.id}
            seasonReplayEnabled={LEADERBOARD_SEASON_REPLAY_ENABLED}
            seasonReplayOutcome={seasonReplayOutcome}
          >
            {children}
          </ProtectedShell>
        </LocalizedAppProviders>
      );
    }

    redirect("/onboarding");
  }

  return (
    <LocalizedAppProviders>
      <ProtectedShell
        profile={profile as Profile | null}
        userEmail={user.email ?? null}
        userId={user.id}
        seasonReplayEnabled={LEADERBOARD_SEASON_REPLAY_ENABLED}
        seasonReplayOutcome={seasonReplayOutcome}
      >
        {children}
      </ProtectedShell>
    </LocalizedAppProviders>
  );
}
