"use server";

import { updateMaintenanceState } from "@/lib/api/maintenance";

export async function saveMaintenanceSettings(input: unknown) {
  return updateMaintenanceState(input);
}
