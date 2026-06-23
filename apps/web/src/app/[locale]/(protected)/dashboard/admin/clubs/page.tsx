import { ClubsDashboard } from "@/components/admin/clubs/ClubsDashboard";
import { getAdminClubsPageData } from "@/lib/api/admin-clubs";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin - Clubs" };

export default async function AdminClubsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const data = await getAdminClubsPageData({
    searchParams: resolvedSearchParams,
  });

  return <ClubsDashboard data={data} />;
}
