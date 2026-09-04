import { getLocale } from "next-intl/server";
import { getParentReportRoster } from "@/app/actions/admin-classes";
import { ParentReportPicker } from "@/components/admin/classes/ParentReportPicker";
import { defaultReportMonth } from "@/lib/ielts/parent-report/request";

export default async function ParentReportsPage({ params }: { params: Promise<{ classId: string }> }) {
  const { classId } = await params;
  const [roster, locale] = await Promise.all([getParentReportRoster({ classId }), getLocale()]);
  return <ParentReportPicker roster={roster} locale={locale === "en" ? "en" : "vi"} month={defaultReportMonth(new Date(), roster.timeZone)} />;
}
