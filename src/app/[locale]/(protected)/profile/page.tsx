import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAnalyticsPageData, normalizeRangePreset } from "@/lib/api/analytics-page";
import { AnalyticsPage } from "@/components/analytics/analytics-page";

export const metadata = { title: "Analytics — DebateLab" };

interface ProfilePageProps {
  searchParams: Promise<{ range?: string }>;
}

export default async function ProfilePage({ searchParams }: ProfilePageProps) {
  const params = await searchParams;
  const range = normalizeRangePreset(params.range);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const data = await getAnalyticsPageData(user.id, range);

  return <AnalyticsPage data={data} />;
}
