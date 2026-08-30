import { OrganizationOverview } from "@/components/organizations/organization-overview";
import { getAdminClubDetail } from "@/lib/api/admin-clubs";
import {
  normalizeOrganizationRole,
  organizationTypeFromLegacyClubType,
} from "@/lib/organizations/compatibility";
import { createClient } from "@/lib/supabase/server";

type Props = { params: Promise<{ locale: string; organizationId: string }> };

export default async function OrganizationPage({ params }: Props) {
  const { locale, organizationId } = await params;
  const language = locale === "vi" ? "vi" : "en";
  const supabase = await createClient();
  const [{ data: auth }, detail] = await Promise.all([
    supabase.auth.getUser(),
    getAdminClubDetail(organizationId),
  ]);

  if (!auth.user || !detail) {
    return <OrganizationOverview locale={language} state="empty" />;
  }

  const membership = detail.members.find(
    (member) => member.userId === auth.user?.id && member.status === "active",
  );
  const role = normalizeOrganizationRole(membership?.role);
  if (!role) {
    return <OrganizationOverview locale={language} state="empty" />;
  }

  const organization = {
    id: detail.club.id,
    name: detail.club.name,
    type: organizationTypeFromLegacyClubType(detail.club.clubType),
    status: detail.club.status,
    memberCount: detail.members.filter((member) => member.status === "active")
      .length,
    role,
    href: `/${locale}/organizations/${detail.club.id}`,
  };

  return (
    <OrganizationOverview
      locale={language}
      organization={organization}
      relatedOrganizations={[organization]}
      stats={{
        people: organization.memberCount,
        classes: detail.cohorts.length,
        upcoming: detail.club.upcomingEventCount,
        reviews: role === "teacher" ? detail.reviewQueue.length : 0,
      }}
      setupHref={
        role === "owner"
          ? `/${locale}/dashboard/admin/organizations/${organizationId}/setup`
          : undefined
      }
    />
  );
}
