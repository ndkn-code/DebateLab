import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/api/dashboard";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { OnboardingModal } from "@/components/onboarding/onboarding-modal";

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

  const displayName =
    data.profile?.display_name ||
    user.user_metadata?.display_name ||
    user.email?.split("@")[0] ||
    "Debater";

  const showOnboarding = data.profile?.onboarding_completed === false;

  return (
    <>
      {showOnboarding && <OnboardingModal userId={user.id} />}
      <DashboardContent data={data} displayName={displayName} />
    </>
  );
}
