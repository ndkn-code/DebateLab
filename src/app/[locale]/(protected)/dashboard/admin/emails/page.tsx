import { EmailMonitorDashboard } from "@/components/admin/emails/EmailMonitorDashboard";
import { isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";
import { getEmailAdminDashboardData } from "@/lib/email/admin";
import { getEmailAdminFixtureData } from "@/lib/email/dev-fixtures";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Admin - Email Monitor" };

export default async function EmailMonitorPage() {
  if (isDevAdminBypassEnabled()) {
    return <EmailMonitorDashboard data={getEmailAdminFixtureData()} />;
  }

  const supabase = await createClient();
  const data = await getEmailAdminDashboardData(supabase);

  return <EmailMonitorDashboard data={data} />;
}
