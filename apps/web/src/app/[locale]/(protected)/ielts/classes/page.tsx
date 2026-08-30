import { notFound } from "next/navigation";
import { StudentLmsWeek } from "@/components/lms/StudentLmsWeek";
import { loadMyStudentLmsWeek } from "@/lib/api/class-lms/student-weekly-repository";
import { STUDENT_LMS_WORKSPACE_V1 } from "@/lib/features";

export const dynamic = "force-dynamic";
export const metadata = { title: "My IELTS classes" };

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function mondayFor(value?: string): string {
  const parsed =
    value && /^\d{4}-\d{2}-\d{2}$/.test(value)
      ? new Date(`${value}T12:00:00Z`)
      : new Date();
  const day = parsed.getUTCDay();
  parsed.setUTCDate(parsed.getUTCDate() - ((day + 6) % 7));
  return isoDate(parsed);
}

function addDays(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return isoDate(date);
}

export default async function IeltsClassesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ weekStart?: string }>;
}) {
  if (!STUDENT_LMS_WORKSPACE_V1) notFound();
  const [{ locale }, filters] = await Promise.all([params, searchParams]);
  const startDate = mondayFor(filters.weekStart);
  const data = await loadMyStudentLmsWeek({
    startDate,
    endDate: addDays(startDate, 6),
  });

  return <StudentLmsWeek data={data} locale={locale} />;
}
