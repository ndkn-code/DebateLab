import { ClubsDashboard } from "@/components/admin/clubs/ClubsDashboard";
import { getAdminClubsPageData } from "@/lib/api/admin-clubs";
import { ORGANIZATIONS_V1 } from "@/lib/features";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin - Clubs" };

export default async function AdminClubsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  if (ORGANIZATIONS_V1) {
    redirect(`/${locale}/dashboard/admin/organizations?from=clubs`);
  }
  const resolvedSearchParams = await searchParams;
  const data = await getAdminClubsPageData({
    searchParams: resolvedSearchParams,
  });

  return <ClubsDashboard data={data} />;
}
