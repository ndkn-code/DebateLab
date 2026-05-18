import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/api/dashboard";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { StudentRouteSkeleton } from "@/components/shared/student-route-skeleton";
import { DEV_ADMIN_PROFILE } from "@/lib/dev-admin-bypass";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";

export const metadata = {
  title: "Dashboard",
};

async function DashboardPayload() {
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
  const data = await getDashboardData(activeUserId);

  // Get preferences for welcome banner check
  const profile = data.profile ?? (devAuthBypassUser ? DEV_ADMIN_PROFILE : null);

  const displayName =
    profile?.display_name ||
    user?.user_metadata?.display_name ||
    user?.email?.split("@")[0] ||
    devAuthBypassUser?.email?.split("@")[0] ||
    "Debater";

  // Check if first dashboard visit after onboarding
  const prefs = (profile?.preferences as Record<string, unknown>) ?? {};
  const showWelcome = prefs.first_dashboard_visit === true;

  return (
    <DashboardContent
      data={data}
      displayName={displayName}
      userId={activeUserId}
      showWelcome={showWelcome}
    />
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<StudentRouteSkeleton variant="dashboard" />}>
      <DashboardPayload />
    </Suspense>
  );
}
