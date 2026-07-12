import "server-only";

import { isDevAdminBypassEnabled } from "@/lib/dev-admin-bypass";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import { createTypedServerClient } from "@/lib/supabase/server";
import {
  maintenanceUpdateSchema,
  mapMaintenanceRow,
  type MaintenanceState,
} from "@/lib/maintenance/model";

const MAINTENANCE_ID = "singleton";
const MAINTENANCE_COLUMNS =
  "mode, banner_message_en, banner_message_vi, full_message_en, full_message_vi, expected_done_at, updated_at";

async function verifyAdmin(): Promise<string | null> {
  if (isDevAdminBypassEnabled()) return null;
  const supabase = await createTypedServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("maintenance: unauthorized");
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profileError || profile?.role !== "admin") {
    throw new Error("maintenance: forbidden");
  }
  return user.id;
}

export async function getMaintenanceState(): Promise<MaintenanceState> {
  const supabase = await createTypedServerClient();
  const { data, error } = await supabase
    .from("maintenance_settings")
    .select(MAINTENANCE_COLUMNS)
    .eq("id", MAINTENANCE_ID)
    .single();
  if (error || !data) {
    throw new Error(`maintenance(read): ${error?.message ?? "missing singleton"}`);
  }
  return mapMaintenanceRow(data);
}

export async function updateMaintenanceState(input: unknown): Promise<MaintenanceState> {
  const parsed = maintenanceUpdateSchema.parse(input);
  const updatedBy = await verifyAdmin();
  const admin = createTypedAdminClient();
  const { data, error } = await admin
    .from("maintenance_settings")
    .update({
      mode: parsed.mode,
      banner_message_en: parsed.bannerMessage.en,
      banner_message_vi: parsed.bannerMessage.vi,
      full_message_en: parsed.fullMessage.en,
      full_message_vi: parsed.fullMessage.vi,
      expected_done_at: parsed.mode === "full" ? parsed.expectedDoneAt : null,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("id", MAINTENANCE_ID)
    .select(MAINTENANCE_COLUMNS)
    .single();
  if (error || !data) {
    throw new Error(`maintenance(update): ${error?.message ?? "missing singleton"}`);
  }
  return mapMaintenanceRow(data);
}
