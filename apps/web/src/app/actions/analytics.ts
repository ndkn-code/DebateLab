"use server";

import { createClient } from "@/lib/supabase/server";
import { getOverviewData } from "@/lib/services/analyticsService";
import type { AnalyticsOverview } from "@/lib/types/admin";

export async function getAnalyticsOverview(days: number = 30): Promise<AnalyticsOverview> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") throw new Error("Forbidden");

  return getOverviewData(supabase, user.id, days);
}
