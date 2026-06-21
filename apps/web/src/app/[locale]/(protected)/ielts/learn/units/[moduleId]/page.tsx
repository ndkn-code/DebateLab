import { notFound } from "next/navigation";
import { getIeltsLearnUnitData } from "@/lib/api/ielts/learn-path-repository";
import { LearnUnitScreen } from "@/components/ielts/learn/LearnUnitScreen";
import { resolveIeltsLearnContext } from "../../_resolve-user";

export const dynamic = "force-dynamic";

export default async function IeltsLearnUnitPage({
  params,
}: {
  params: Promise<{ locale: string; moduleId: string }>;
}) {
  const { moduleId } = await params;
  const { userId, client } = await resolveIeltsLearnContext();
  const view = await getIeltsLearnUnitData(userId, moduleId, client);
  if (!view) notFound();
  return <LearnUnitScreen view={view} />;
}
