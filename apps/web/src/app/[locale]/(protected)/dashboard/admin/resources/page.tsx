import { AdminResourcesManager } from "@/components/admin/resources/AdminResourcesManager";
import { listResourceClubs, listResources } from "@/lib/api/resources";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin - Resources" };

export default async function AdminResourcesPage() {
  const [resources, clubs] = await Promise.all([listResources(), listResourceClubs()]);
  return <AdminResourcesManager initialResources={resources} clubs={clubs} />;
}
