import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProtectedShell } from "./protected-shell";
import { getActiveSubject } from "@/lib/subject/server";
import { LocalizedAppProviders } from "../localized-app-providers";
import { DEV_ADMIN_PROFILE, isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";
import { IELTS_ENABLED, LEADERBOARD_SEASON_REPLAY_ENABLED } from "@/lib/features";
import { isEnrolledStudent } from "@/lib/ielts/enrollment";
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

async function getIeltsEnrollmentForShell(
  userId: string,
  activeSubject: string,
): Promise<boolean> {
  if (activeSubject !== "ielts") return false;
  return isEnrolledStudent(userId);
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
      // Dev bypass renders the admin profile, so the IELTS track is reachable.
      const activeSubject = await getActiveSubject({ ieltsAccessible: true });
      const isEnrolledIeltsStudent = await getIeltsEnrollmentForShell(
        devAuthBypassUser?.id ?? DEV_ADMIN_PROFILE.id,
        activeSubject,
      );
      return (
        <LocalizedAppProviders>
          <ProtectedShell
            profile={DEV_ADMIN_PROFILE}
            userEmail={devAuthBypassUser?.email ?? DEV_ADMIN_PROFILE.email}
            userId={devAuthBypassUser?.id ?? DEV_ADMIN_PROFILE.id}
            activeSubject={activeSubject}
            isEnrolledIeltsStudent={isEnrolledIeltsStudent}
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
      const activeSubject = await getActiveSubject({ ieltsAccessible: true });
      const isEnrolledIeltsStudent = await getIeltsEnrollmentForShell(
        user.id,
        activeSubject,
      );
      return (
        <LocalizedAppProviders>
          <ProtectedShell
            profile={DEV_ADMIN_PROFILE}
            userEmail={user.email ?? DEV_ADMIN_PROFILE.email}
            userId={user.id}
            activeSubject={activeSubject}
            isEnrolledIeltsStudent={isEnrolledIeltsStudent}
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

  // Admins can opt into the IELTS track in production before the flag flips on;
  // for everyone else this stays `IELTS_ENABLED`, so debate is byte-identical.
  const activeSubject = await getActiveSubject({
    ieltsAccessible: IELTS_ENABLED || profile?.role === "admin",
  });
  const isEnrolledIeltsStudent = await getIeltsEnrollmentForShell(
    user.id,
    activeSubject,
  );

  return (
    <LocalizedAppProviders>
      <ProtectedShell
        profile={profile as Profile | null}
        userEmail={user.email ?? null}
        userId={user.id}
        activeSubject={activeSubject}
        isEnrolledIeltsStudent={isEnrolledIeltsStudent}
        seasonReplayEnabled={LEADERBOARD_SEASON_REPLAY_ENABLED}
        seasonReplayOutcome={seasonReplayOutcome}
      >
        {children}
      </ProtectedShell>
    </LocalizedAppProviders>
  );
}
