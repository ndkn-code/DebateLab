import { OrganizationSetupWizard } from "@/components/admin/organizations/OrganizationSetupWizard";
import type { Metadata } from "next";
import { deriveOrganizationSetupStep } from "@/components/admin/organizations/organization-setup-model";
import { redirect } from "next/navigation";
import { getAdminClubDetail } from "@/lib/api/admin-clubs";
import { getOrganizationSetupVersion } from "@/lib/api/organizations/setup-repository";
import { ORGANIZATIONS_V1 } from "@/lib/features";
import { normalizeOrganizationRole } from "@/lib/organizations/compatibility";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: locale === "vi" ? "Thiết lập tổ chức" : "Organization setup",
  };
}

export default async function OrganizationSetupPage({
  params,
}: {
  params: Promise<{ locale: string; organizationId: string }>;
}) {
  const { locale, organizationId } = await params;
  if (!ORGANIZATIONS_V1) {
    redirect(`/${locale}/dashboard/admin/clubs/${organizationId}`);
  }
  const language = locale === "vi" ? "vi" : "en";
  const [data, setupVersion] = await Promise.all([
    getAdminClubDetail(organizationId),
    getOrganizationSetupVersion(organizationId),
  ]);

  if (!data) {
    return (
      <OrganizationSetupWizard
        locale={language}
        available={false}
        initialDraft={{ organizationId }}
      />
    );
  }

  const firstClass = data.cohorts[0];
  const firstInvitation = data.invitations.find(
    (invitation) => invitation.status === "pending",
  );
  const firstTeacher = data.members.find(
    (member) => normalizeOrganizationRole(member.role) === "teacher",
  );
  const initialStep = deriveOrganizationSetupStep({
    status: data.club.status,
    hasClass: Boolean(firstClass),
    hasPeople: Boolean(firstInvitation || data.members.length > 1),
    setupVersion,
  });

  return (
    <OrganizationSetupWizard
      locale={language}
      initialStep={initialStep}
      initialDraft={{
        organizationId,
        organizationType: data.club.organizationType,
        name: data.club.name,
        country: data.club.country,
        city: data.club.city ?? "",
        timezone: data.club.timezone,
        logoUrl: data.club.logoUrl ?? "",
        facebookUrl: data.club.facebookUrl ?? "",
        instagramUrl: data.club.instagramUrl ?? "",
        threadsUrl: data.club.threadsUrl ?? "",
        inviteEmail: firstInvitation?.email ?? "",
        inviteRole:
          normalizeOrganizationRole(firstInvitation?.role, "teacher") ??
          "teacher",
        classId: firstClass?.id,
        classTitle: firstClass?.title ?? "",
        programType: firstClass?.programType ?? "debate",
        teacherId: firstTeacher?.userId ?? "",
        status: data.club.status,
      }}
    />
  );
}
