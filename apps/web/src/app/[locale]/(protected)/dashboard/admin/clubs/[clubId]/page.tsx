import { notFound } from "next/navigation";
import { ClubDetailDashboard } from "@/components/admin/clubs/ClubDetailDashboard";
import { getAdminClubDetail } from "@/lib/api/admin-clubs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin - Club Detail" };

export default async function AdminClubDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ clubId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ clubId }, resolvedSearchParams] = await Promise.all([
    params,
    searchParams,
  ]);
  const data = await getAdminClubDetail(clubId, resolvedSearchParams);
  if (!data) notFound();

  return <ClubDetailDashboard data={data} />;
}
