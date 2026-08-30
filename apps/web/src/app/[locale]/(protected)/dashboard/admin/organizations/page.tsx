import { OrganizationAdminWorkbench } from "@/components/admin/organizations/OrganizationAdminWorkbench";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getAdminClubsPageData } from "@/lib/api/admin-clubs";
import { ORGANIZATIONS_V1 } from "@/lib/features";
import { organizationTypeFromLegacyClubType } from "@/lib/organizations/compatibility";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "vi" ? "Quản trị - Tổ chức" : "Admin - Organizations",
  };
}

function value(input: string | string[] | undefined, fallback: string) {
  return Array.isArray(input) ? (input[0] ?? fallback) : (input ?? fallback);
}

export default async function AdminOrganizationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ locale }, query] = await Promise.all([params, searchParams]);
  if (!ORGANIZATIONS_V1) redirect(`/${locale}/dashboard/admin/clubs`);
  const data = await getAdminClubsPageData({ searchParams: query });
  const language = locale === "vi" ? "vi" : "en";
  const filters = {
    query: value(query.q, "").trim(),
    type: value(query.type, "all"),
    status: value(query.status, "all"),
  };
  const normalizedQuery = filters.query.toLocaleLowerCase(language);
  const organizations = data.clubs
    .map((organization) => ({
      id: organization.id,
      name: organization.name,
      type: organizationTypeFromLegacyClubType(organization.clubType),
      status: organization.status,
      city: organization.city,
      memberCount: organization.studentCount + organization.coachCount,
      classCount: organization.classCount,
    }))
    .filter(
      (organization) =>
        (filters.type === "all" || organization.type === filters.type) &&
        (filters.status === "all" || organization.status === filters.status) &&
        (!normalizedQuery ||
          organization.name
            .toLocaleLowerCase(language)
            .includes(normalizedQuery) ||
          organization.city
            ?.toLocaleLowerCase(language)
            .includes(normalizedQuery)),
    );

  return (
    <OrganizationAdminWorkbench
      locale={language}
      organizations={organizations}
      filters={filters}
      showCompatibilityNotice={value(query.from, "") === "clubs"}
      loadError={Boolean(data.loadError)}
    />
  );
}
