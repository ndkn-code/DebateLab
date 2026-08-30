import { notFound } from "next/navigation";
import { StudentLmsWeek } from "@/components/lms/StudentLmsWeek";
import { getSessionUserId } from "@/lib/api/ielts/assignment-access";
import { loadMyStudentLmsWeek } from "@/lib/api/class-lms/student-weekly-repository";
import { DEFAULT_CLASS_TIMEZONE } from "@/lib/api/admin-class-schedules-model";
import {
  addIsoDateDays,
  weekStartForTimezone,
} from "@/lib/api/class-lms/weekly-model";
import { STUDENT_LMS_WORKSPACE_V1 } from "@/lib/features";
import { normalizeStreakTimezone } from "@/lib/streaks/model";
import { createTypedServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "My IELTS classes" };

export default async function IeltsClassesPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ weekStart?: string }>;
}) {
  if (!STUDENT_LMS_WORKSPACE_V1) notFound();
  const [{ locale }, filters] = await Promise.all([params, searchParams]);
  const db = await createTypedServerClient();
  const userId = await getSessionUserId(db);
  const { data: plan, error: planError } = await db
    .from("ielts_study_plans")
    .select("timezone")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (planError)
    throw new Error(`load IELTS class timezone: ${planError.message}`);
  const timezone = normalizeStreakTimezone(
    plan?.timezone ?? DEFAULT_CLASS_TIMEZONE,
  );
  const startDate = weekStartForTimezone(filters.weekStart, timezone);
  const data = await loadMyStudentLmsWeek({
    startDate,
    endDate: addIsoDateDays(startDate, 6),
  });

  return <StudentLmsWeek data={data} locale={locale} timezone={timezone} />;
}
