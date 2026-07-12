import { MaintenanceSettingsForm } from "@/components/admin/maintenance/MaintenanceSettingsForm";
import { getMaintenanceState } from "@/lib/api/maintenance";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin - Maintenance" };

export default async function AdminMaintenancePage() {
  const maintenance = await getMaintenanceState();
  return <MaintenanceSettingsForm initialState={maintenance} />;
}
