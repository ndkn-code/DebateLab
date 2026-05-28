import { createClient } from "@/lib/supabase/server";
import { getOverviewData } from "@/lib/services/analyticsService";
import { OverviewDashboard } from "@/components/admin/overview/OverviewDashboard";
import { DEV_ADMIN_PROFILE } from "@/lib/dev-admin-bypass";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";

export const metadata = { title: "Admin — Overview" };

export default async function OverviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const devAuthBypassUser = user
    ? null
    : await getDevAuthBypassUserFromServerContext();

  const activeUserId = user?.id ?? devAuthBypassUser?.id ?? DEV_ADMIN_PROFILE.id;
  const data = await getOverviewData(supabase, activeUserId);

  return <OverviewDashboard initialData={data} />;
}
