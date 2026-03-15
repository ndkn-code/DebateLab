import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/api/dashboard";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { WelcomeBanner } from "@/components/onboarding/welcome-banner";

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

  // Redirect to onboarding if not completed
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarding_completed, preferences")
    .eq("id", user.id)
    .single();

  if (profile && !profile.onboarding_completed) {
    redirect("/onboarding");
  }

  const data = await getDashboardData(user.id);

  const displayName =
    data.profile?.display_name ||
    user.user_metadata?.display_name ||
    user.email?.split("@")[0] ||
    "Debater";

  // Check if first dashboard visit after onboarding
  const prefs = (profile?.preferences as Record<string, unknown>) ?? {};
  const showWelcome = prefs.first_dashboard_visit === true;

  return (
    <>
      <div className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <WelcomeBanner
          displayName={displayName}
          userId={user.id}
          show={showWelcome}
        />
      </div>
      <DashboardContent data={data} displayName={displayName} />
    </>
  );
}
