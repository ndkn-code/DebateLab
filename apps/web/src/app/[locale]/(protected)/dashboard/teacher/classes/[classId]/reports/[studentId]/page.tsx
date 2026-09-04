import { getLocale } from "next-intl/server";
import { getParentBandReport, getParentReportRoster, exportParentBandReport } from "@/app/actions/admin-classes";
import { ParentBandReportScreen } from "@/components/ielts/parent-report";
import { defaultReportMonth } from "@/lib/ielts/parent-report/request";

export default async function ParentBandReportPage({ params, searchParams }: {
  params: Promise<{ classId: string; studentId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const [{ classId, studentId }, query, locale] = await Promise.all([params, searchParams, getLocale()]);
  const roster = await getParentReportRoster({ classId });
  const report = await getParentBandReport({ classId, studentId, month: query.month ?? defaultReportMonth(new Date(), roster.timeZone) });
  return <ParentBandReportScreen key={`${studentId}:${report.period.month}`} initialReport={report} roster={roster} locale={locale === "en" ? "en" : "vi"} getReport={getParentBandReport} exportReport={exportParentBandReport} />;
}
