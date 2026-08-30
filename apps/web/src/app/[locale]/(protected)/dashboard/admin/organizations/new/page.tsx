import { OrganizationSetupWizard } from "@/components/admin/organizations/OrganizationSetupWizard";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ORGANIZATIONS_V1 } from "@/lib/features";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  return { title: locale === "vi" ? "Tạo tổ chức" : "New organization" };
}

export default async function NewOrganizationPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!ORGANIZATIONS_V1) redirect(`/${locale}/dashboard/admin/clubs`);
  return <OrganizationSetupWizard locale={locale === "vi" ? "vi" : "en"} />;
}
