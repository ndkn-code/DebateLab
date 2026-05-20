import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";
import { getAnalyticsPageData, normalizeRangePreset } from "@/lib/api/analytics-page";
import { coercePracticeLanguage } from "@/lib/practice-language";
import { AnalyticsPage } from "@/components/analytics/analytics-page";

export const metadata = { title: "Analytics — Thinkfy" };
export const dynamic = "force-dynamic";

interface ProfilePageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ range?: string }>;
}

export default async function ProfilePage({ params, searchParams }: ProfilePageProps) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  const range = normalizeRangePreset(query.range);
  const practiceLanguage = coercePracticeLanguage(locale);
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

  const data = await getAnalyticsPageData(
    user?.id ?? devAuthBypassUser!.id,
    range,
    practiceLanguage
  );

  return <AnalyticsPage data={data} />;
}
