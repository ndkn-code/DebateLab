import { FeedbackPopupsDashboard } from "@/components/admin/feedback-popups/FeedbackPopupsDashboard";
import { getFeedbackPopupAdminData } from "@/lib/smart-popups/admin";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata = { title: "Admin - Feedback Popups" };

export default async function FeedbackPopupsAdminPage() {
  const data = await getFeedbackPopupAdminData(createAdminClient());
  return <FeedbackPopupsDashboard initialData={data} />;
}
