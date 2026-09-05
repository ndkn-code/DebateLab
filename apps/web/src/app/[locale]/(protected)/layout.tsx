import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { ProtectedShell } from "./protected-shell";
import { getActiveSubject } from "@/lib/subject/server";
import {
  IELTS_ENABLED,
  LEADERBOARD_SEASON_REPLAY_ENABLED,
} from "@/lib/features";
import { isEnrolledStudent } from "@/lib/ielts/enrollment";
import { getLeaderboardPageData } from "@/lib/leaderboards/data";
import { coerceLeaderboardLanguage } from "@/lib/leaderboards/model";
import type {
  LeaderboardLanguage,
  LeaderboardSeasonOutcome,
} from "@/lib/leaderboards/types";
import type { Profile } from "@/types/database";
import { loadTeacherSidebarSummary } from "@/lib/api/class-lms/teacher-workspace-sidebar";
import type { TeacherWorkspaceNavigation } from "@/lib/teacher-workspace/presentation";

export const dynamic = "force-dynamic";

async function getTeacherNavigation(
  requestPath: string,
): Promise<TeacherWorkspaceNavigation | undefined> {
  const unlocalizedPath = requestPath.replace(/^\/(?:en|vi)(?=\/)/, "");
  const isTeacherRoute = unlocalizedPath.startsWith("/dashboard/teacher");

  try {
    const summary = await loadTeacherSidebarSummary();
    return {
      canAccess: summary.capability.canAccess || summary.items.length > 0,
      isAdminPreview: summary.capability.isPlatformAdmin,
      isHeadTeacher: summary.capability.isHeadTeacher,
      hasIeltsEntitlement: summary.capability.hasIeltsEntitlement,
      classCount: summary.classCount,
      pendingReviewCount:
        summary.pendingReviewCount + summary.pendingHomeworkCount,
      items: summary.items,
      classes: summary.classes,
      organizations: summary.organizations,
    };
  } catch {
    if (!isTeacherRoute) return undefined;
    // The teacher route owns its denied/error state. Keeping a path-scoped
    // fallback here prevents the shell from flashing learner navigation.
    return {
      canAccess: false,
      isAdminPreview: false,
      isHeadTeacher: false,
      hasIeltsEntitlement: false,
      classCount: 0,
      pendingReviewCount: 0,
      items: [],
      classes: [],
      organizations: [],
      loadError: true,
    };
  }
}

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
  const requestPath =
    (await headers()).get("x-thinkfy-pathname") ?? "/dashboard";
  const leaderboardLanguage = coerceLeaderboardLanguage(locale);
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const unlocalizedPath = requestPath.replace(/^\/(?:en|vi)(?=\/)/, "");
    redirect(`/auth/login?next=${encodeURIComponent(unlocalizedPath)}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "id, display_name, avatar_url, handle, profile_status, role, onboarding_completed, preferences, orb_balance, referral_code, xp, level, selected_title",
    )
    .eq("id", user.id)
    .single();
  const seasonReplayOutcome = await getShellSeasonReplayOutcome(
    user.id,
    leaderboardLanguage,
  );

  // Redirect to onboarding if profile missing or not completed
  if (!profile || !profile.onboarding_completed) {
    redirect("/onboarding");
  }

  // Admins can opt into the IELTS track in production before the flag flips on;
  // for everyone else this stays `IELTS_ENABLED`, so debate is byte-identical.
  const teacherNavigation = await getTeacherNavigation(requestPath);
  const activeSubject = await getActiveSubject({
    ieltsAccessible:
      IELTS_ENABLED ||
      profile?.role === "admin" ||
      Boolean(teacherNavigation?.hasIeltsEntitlement),
  });
  const isEnrolledIeltsStudent = await getIeltsEnrollmentForShell(
    user.id,
    activeSubject,
  );
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
    >
      {children}
    </ProtectedShell>
  );
}
