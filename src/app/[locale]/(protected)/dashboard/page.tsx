import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/api/dashboard";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export const metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const data = await getDashboardData(user.id);

  // Get preferences for welcome banner check
  const profile = data.profile;

  const displayName =
    data.profile?.display_name ||
    user.user_metadata?.display_name ||
    user.email?.split("@")[0] ||
    "Debater";

  // Check if first dashboard visit after onboarding
  const prefs = (profile?.preferences as Record<string, unknown>) ?? {};
  const showWelcome = prefs.first_dashboard_visit === true;

  return (
    <DashboardContent
      data={data}
      displayName={displayName}
      userId={user.id}
      showWelcome={showWelcome}
    />
  );
}
