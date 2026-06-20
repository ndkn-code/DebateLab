import { redirect } from "next/navigation";
import { IeltsTestEditor } from "@/components/admin/ielts/IeltsTestEditor";
import { getIeltsTestTree } from "@/lib/api/ielts/tree";
import { listTestVersions } from "@/lib/api/ielts/versions-repository";

export const metadata = { title: "Admin — IELTS test" };

export default async function IeltsTestPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const { testId } = await params;
  const tree = await getIeltsTestTree(testId);
  if (!tree) redirect("/dashboard/admin/ielts");
  const versions = await listTestVersions(testId);
  return <IeltsTestEditor tree={tree} versions={versions} />;
}
