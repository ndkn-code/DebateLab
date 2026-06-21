import { redirect } from "next/navigation";
import { IeltsTestEditor } from "@/components/admin/ielts/IeltsTestEditor";
import { getIeltsTestTree } from "@/lib/api/ielts/tree";
import { listTestVersions } from "@/lib/api/ielts/versions-repository";
import {
  listIeltsMicroItemPublishTargets,
  listMicroItemDraftsForTest,
} from "@/lib/ielts/micro-drafts/repository";

export const metadata = { title: "Admin — IELTS test" };

export default async function IeltsTestPage({
  params,
}: {
  params: Promise<{ testId: string }>;
}) {
  const { testId } = await params;
  const tree = await getIeltsTestTree(testId);
  if (!tree) redirect("/dashboard/admin/ielts");
  const [versions, microDrafts, microDraftTargets] = await Promise.all([
    listTestVersions(testId),
    listMicroItemDraftsForTest(testId),
    listIeltsMicroItemPublishTargets(),
  ]);
  return (
    <IeltsTestEditor
      tree={tree}
      versions={versions}
      microDrafts={microDrafts}
      microDraftTargets={microDraftTargets}
    />
  );
}
