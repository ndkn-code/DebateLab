import { createClient } from "@/lib/supabase/server";
import { getOverviewData } from "@/lib/services/analyticsService";
import { OverviewDashboard } from "@/components/admin/overview/OverviewDashboard";

export const metadata = { title: "Admin — Overview" };

export default async function OverviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const data = await getOverviewData(supabase, user!.id);

  return <OverviewDashboard initialData={data} />;
}
