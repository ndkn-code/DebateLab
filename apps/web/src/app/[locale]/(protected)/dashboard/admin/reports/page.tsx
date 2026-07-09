import { SupportReportsDashboard } from "@/components/admin/reports/SupportReportsDashboard";
import { listSupportReports } from "@/lib/api/support-reports";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin - Reports" };

function getSearchParam(
  params: Record<string, string | string[] | undefined>,
  key: string
) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export default async function AdminSupportReportsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const data = await listSupportReports({
    status: getSearchParam(resolvedSearchParams, "status"),
    severity: getSearchParam(resolvedSearchParams, "severity"),
    issueType: getSearchParam(resolvedSearchParams, "issue_type"),
    source: getSearchParam(resolvedSearchParams, "source"),
    search:
      getSearchParam(resolvedSearchParams, "search") ??
      getSearchParam(resolvedSearchParams, "q"),
    page: getSearchParam(resolvedSearchParams, "page"),
  });

  return <SupportReportsDashboard data={data} />;
}
