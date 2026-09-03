import { notFound } from "next/navigation";
import { ClubDetailDashboard } from "@/components/admin/clubs/ClubDetailDashboard";
import { getAdminClubDetail } from "@/lib/api/admin-clubs";

export const metadata = { title: "Club Workspace" };

export default async function ClubWorkspacePage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  const data = await getAdminClubDetail(clubId);
  if (!data) notFound();

  return <ClubDetailDashboard data={data} />;
}
