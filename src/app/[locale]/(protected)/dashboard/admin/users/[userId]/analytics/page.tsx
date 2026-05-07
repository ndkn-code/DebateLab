import { createClient } from "@/lib/supabase/server";
import { getAdminUserAnalyticsProfile } from "@/lib/analytics/admin-user-analytics";
import { UserAnalyticsDashboard } from "@/components/admin/users/UserAnalyticsDashboard";

export const metadata = { title: "Admin - User Analytics" };

export default async function AdminUserAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ range?: string }>;
}) {
  const [{ userId }, query] = await Promise.all([params, searchParams]);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const data = await getAdminUserAnalyticsProfile(user?.id ?? null, userId, query.range);

  return <UserAnalyticsDashboard initialData={data} />;
}
