import { FeedbackPopupsDashboard } from "@/components/admin/feedback-popups/FeedbackPopupsDashboard";
import {
  createEmptyFeedbackPopupAdminData,
  getFeedbackPopupAdminData,
} from "@/lib/smart-popups/admin";
import { getAdminClientConfigStatus, tryCreateAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Admin - Feedback Popups" };

export default async function FeedbackPopupsAdminPage() {
  const config = getAdminClientConfigStatus();
  const serviceRoleConfigured = config.hasUrl && config.hasServiceRoleKey;
  const admin = tryCreateAdminClient();
  const dataSource = admin ? "service_role" : "session";
  let initialData: Awaited<ReturnType<typeof getFeedbackPopupAdminData>>;

  try {
    const supabase = admin ?? (await createClient());
    initialData = await getFeedbackPopupAdminData(supabase, {
      dataSource,
      serviceRoleConfigured,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Feedback popup data could not be loaded.";
    console.error("[feedback-popups-admin] Unable to load admin data", { message });

    initialData = createEmptyFeedbackPopupAdminData({
      status: "error",
      message,
      dataSource,
      serviceRoleConfigured,
    });
  }

  return <FeedbackPopupsDashboard initialData={initialData} />;
}
