import { maintenanceStateSchema, type MaintenanceState } from "./model";

export async function fetchPublicMaintenanceState(): Promise<MaintenanceState> {
  const response = await fetch("/api/public/maintenance", { cache: "no-store" });
  if (!response.ok) throw new Error("Maintenance status is unavailable");
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object" || !("maintenance" in payload)) {
    throw new Error("Maintenance status response is invalid");
  }
  return maintenanceStateSchema.parse(payload.maintenance);
}
