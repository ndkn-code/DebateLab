import { redirect } from "next/navigation";
import { ORGANIZATIONS_V1 } from "@/lib/features";

export default async function LegacyNewClubPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  redirect(
    ORGANIZATIONS_V1
      ? `/${locale}/dashboard/admin/organizations/new?from=clubs`
      : `/${locale}/dashboard/admin/clubs`,
  );
}
