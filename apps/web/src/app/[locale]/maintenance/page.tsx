import { redirect } from "next/navigation";
import { MaintenanceSplash } from "@/components/maintenance/MaintenanceSplash";
import { getMaintenanceState } from "@/lib/api/maintenance";
import { LocalizedAppProviders } from "../localized-app-providers";

export const dynamic = "force-dynamic";
export const metadata = { title: "Scheduled maintenance" };

export default async function MaintenancePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale === "en" ? "en" : "vi";
  let maintenance;
  try {
    maintenance = await getMaintenanceState();
  } catch {
    redirect(`/${locale}`);
  }
  if (maintenance.mode !== "full") redirect(`/${locale}`);
  return (
    <LocalizedAppProviders>
      <MaintenanceSplash initialState={maintenance} locale={locale} />
    </LocalizedAppProviders>
  );
}
