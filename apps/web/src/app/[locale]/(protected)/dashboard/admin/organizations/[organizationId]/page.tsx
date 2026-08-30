import { OrganizationOverview } from "@/components/organizations/organization-overview";
import { redirect } from "next/navigation";
import {
  getAdminClubDetail,
  getAdminClubsPageData,
} from "@/lib/api/admin-clubs";
import { ORGANIZATIONS_V1 } from "@/lib/features";
import { organizationTypeFromLegacyClubType } from "@/lib/organizations/compatibility";

export const dynamic = "force-dynamic";

export default async function AdminOrganizationPage({
  params,
}: {
  params: Promise<{ locale: string; organizationId: string }>;
}) {
  const { locale, organizationId } = await params;
  if (!ORGANIZATIONS_V1) {
    redirect(`/${locale}/dashboard/admin/clubs/${organizationId}`);
  }
  const language = locale === "vi" ? "vi" : "en";
  const [detail, list] = await Promise.all([
    getAdminClubDetail(organizationId),
    getAdminClubsPageData(),
  ]);

  if (!detail) {
    return <OrganizationOverview locale={language} state="empty" />;
  }

  const options = list.clubs.map((organization) => ({
    id: organization.id,
    name: organization.name,
    type: organizationTypeFromLegacyClubType(organization.clubType),
    status: organization.status,
    memberCount: organization.studentCount + organization.coachCount,
    role: "admin" as const,
    href:
      organization.status === "draft"
        ? `/${locale}/dashboard/admin/organizations/${organization.id}/setup`
        : `/${locale}/dashboard/admin/organizations/${organization.id}`,
  }));
  const current =
    options.find((option) => option.id === organizationId) ??
    ({
      id: detail.club.id,
      name: detail.club.name,
      type: organizationTypeFromLegacyClubType(detail.club.clubType),
      status: detail.club.status,
      memberCount: detail.club.studentCount + detail.club.coachCount,
      role: "admin" as const,
      href: `/${locale}/dashboard/admin/organizations/${detail.club.id}`,
    } as const);
  const switcherOptions = options.some((option) => option.id === current.id)
    ? options
    : [current, ...options];

  return (
    <OrganizationOverview
      locale={language}
      organization={current}
      relatedOrganizations={switcherOptions}
      stats={{
        people: detail.members.filter((member) => member.status === "active")
          .length,
        classes: detail.cohorts.length,
        upcoming: detail.club.upcomingEventCount,
        reviews: detail.reviewQueue.length,
      }}
      setupHref={`/${locale}/dashboard/admin/organizations/${organizationId}/setup`}
      legacyHref={`/${locale}/dashboard/admin/clubs/${organizationId}`}
    />
  );
}
