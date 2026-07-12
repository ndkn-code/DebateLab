import { ResourceLibrary } from "@/components/resources/ResourceLibrary";
import { listVisibleResources } from "@/lib/api/resources";

export const dynamic = "force-dynamic";

export default async function ResourcesPage() {
  const resources = await listVisibleResources();
  return <ResourceLibrary resources={resources} />;
}
