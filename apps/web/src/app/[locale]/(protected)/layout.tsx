import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ProtectedShell } from "./protected-shell";
import { getActiveSubject } from "@/lib/subject/server";
import {
  IELTS_ENABLED,
  LEADERBOARD_SEASON_REPLAY_ENABLED,
} from "@/lib/features";
import { loadIeltsEnrollmentState } from "@/lib/ielts/enrollment";
import { getLeaderboardPageData } from "@/lib/leaderboards/data";
import { coerceLeaderboardLanguage } from "@/lib/leaderboards/model";
import type {
  LeaderboardLanguage,
  LeaderboardSeasonOutcome,
} from "@/lib/leaderboards/types";
import type { Profile } from "@/types/database";
import { loadTeacherShellNavigation } from "@/lib/api/class-lms/teacher-workspace-sidebar";
import { boundedFetch } from "@/lib/protected-shell/deadline";
import { shellRecoveryUrl } from "@/lib/protected-shell/recovery";
import { withServerRequestBudget } from "@/lib/supabase/request-budget";
import { loadRequiredProfile } from "@/lib/protected-shell/profile";
import { verifyIdentity } from "@/lib/protected-shell/identity";

export const dynamic = "force-dynamic";

async function getShellSeasonReplayOutcome(
  userId: string,
  leaderboardLanguage: LeaderboardLanguage,
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
  const requestPath =
    (await headers()).get("x-thinkfy-pathname") ?? "/dashboard";
  const leaderboardLanguage = coerceLeaderboardLanguage(locale);
  const supabase = await createClient({ fetch: boundedFetch(2_500) });

  const identity = await verifyIdentity(() => supabase.auth.getUser());
  if (identity.status === "unavailable") redirect(shellRecoveryUrl(requestPath, locale));
  if (identity.status === "anonymous") {
    const unlocalizedPath = requestPath.replace(/^\/(?:en|vi)(?=\/)/, "");
    redirect(`/${locale}/auth/login?next=${encodeURIComponent(unlocalizedPath)}`);
  }
  const user = identity.user;

  // Independent shell reads share a deadline window rather than stacking waits.
  // The destination still owns its authoritative teacher/IELTS authorization.
  const [profileResult, navigationResult, seasonReplayOutcome] = await Promise.all([
    loadRequiredProfile<Profile>(() => supabase
      .from("profiles")
      .select("id, display_name, avatar_url, handle, profile_status, role, onboarding_completed, preferences, orb_balance, referral_code, xp, level, selected_title")
      .eq("id", user.id)
      .maybeSingle(), 3_000),
    withServerRequestBudget(() => loadTeacherShellNavigation(), 3_000)
      .then((value) => ({ value, unavailable: false }))
      .catch(() => ({ value: undefined, unavailable: true })),
    withServerRequestBudget(() => getShellSeasonReplayOutcome(user.id, leaderboardLanguage), 300)
      .catch(() => null),
  ]);
  if (profileResult.status === "unavailable") {
    redirect(shellRecoveryUrl(requestPath, locale));
  }
  // Only a confirmed missing/incomplete profile starts onboarding.
  if (profileResult.status === "onboarding") redirect(`/${locale}/onboarding`);
  const profile = profileResult.profile;

  const isTeacherRoute = /^\/(?:en\/|vi\/)?dashboard\/teacher(?:[/?]|$)/.test(requestPath);
  if (isTeacherRoute && navigationResult.unavailable) {
    redirect(shellRecoveryUrl(requestPath, locale));
  }
  const teacherNavigation = navigationResult.value;
  // Admins can opt into the IELTS track in production before the flag flips on;
  // for everyone else this stays `IELTS_ENABLED`, so debate is byte-identical.
  const activeSubject = await getActiveSubject({
    ieltsAccessible:
      IELTS_ENABLED ||
      profile?.role === "admin" ||
      Boolean(teacherNavigation?.hasIeltsEntitlement),
  });
  const enrollment = await withServerRequestBudget(
    () => activeSubject === "ielts"
      ? loadIeltsEnrollmentState(user.id)
      : Promise.resolve({ status: "available" as const, enrolled: false }), 1_000,
  ).then((state) => ({ value: state.status === "available" && state.enrolled, unavailable: state.status === "unavailable" }))
    .catch(() => ({ value: false, unavailable: true }));
  const isEnrolledIeltsStudent = enrollment.value;
  return (
    <ProtectedShell
      profile={profile as Profile | null}
      userEmail={user.email ?? null}
      userId={user.id}
      activeSubject={activeSubject}
      isEnrolledIeltsStudent={isEnrolledIeltsStudent}
      seasonReplayEnabled={LEADERBOARD_SEASON_REPLAY_ENABLED}
      seasonReplayOutcome={seasonReplayOutcome}
      teacherNavigation={teacherNavigation}
      shellDataUnavailable={navigationResult.unavailable || enrollment.unavailable}
    >
      {children}
    </ProtectedShell>
  );
}
