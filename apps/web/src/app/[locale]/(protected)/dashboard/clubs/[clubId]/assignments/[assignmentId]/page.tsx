import { notFound } from "next/navigation";
import { ClubHomeworkWorkspace } from "@/components/admin/clubs/ClubHomeworkWorkspace";
import { getClubHomeworkWorkspace } from "@/lib/api/club-homework";

export const dynamic = "force-dynamic";
export const metadata = { title: "Assignment" };

export default async function ClubHomeworkAssignmentPage({
  params,
}: {
  params: Promise<{ clubId: string; assignmentId: string }>;
}) {
  const { clubId, assignmentId } = await params;
  const data = await getClubHomeworkWorkspace(clubId, assignmentId);
  if (!data) notFound();

  return <ClubHomeworkWorkspace data={data} />;
}
