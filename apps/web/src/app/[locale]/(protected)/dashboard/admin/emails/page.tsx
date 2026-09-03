import { EmailMonitorDashboard } from "@/components/admin/emails/EmailMonitorDashboard";
import { getEmailAdminDashboardData } from "@/lib/email/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Admin - Email Monitor" };

export default async function EmailMonitorPage() {
  const supabase = await createClient();
  const data = await getEmailAdminDashboardData(supabase);

  return <EmailMonitorDashboard data={data} />;
}
