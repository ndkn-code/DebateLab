import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function OrganizationSetupPage({
  params,
}: {
  params: Promise<{ locale: string; organizationId: string }>;
}) {
  const { locale, organizationId } = await params;
  redirect(`/${locale}/dashboard/admin/organizations/${organizationId}/setup`);
}
