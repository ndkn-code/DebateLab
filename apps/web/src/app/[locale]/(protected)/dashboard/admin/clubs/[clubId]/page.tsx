import { notFound } from "next/navigation";
import { ClubDetailDashboard } from "@/components/admin/clubs/ClubDetailDashboard";
import { getAdminClubDetail } from "@/lib/api/admin-clubs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin - Club Detail" };

export default async function AdminClubDetailPage({
  params,
}: {
  params: Promise<{ clubId: string }>;
}) {
  const { clubId } = await params;
  const data = await getAdminClubDetail(clubId);
  if (!data) notFound();

  return <ClubDetailDashboard data={data} />;
}
