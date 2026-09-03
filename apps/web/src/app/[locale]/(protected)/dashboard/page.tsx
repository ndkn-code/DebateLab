import { redirect } from "next/navigation";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getDashboardData } from "@/lib/api/dashboard";
import { SUBJECT_COOKIE_NAME, coerceSubject } from "@/lib/subject";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { StudentRouteSkeleton } from "@/components/shared/student-route-skeleton";
import { getTimeGreetingKey } from "@/components/dashboard/plan-copy";
import { TEACHER_WORKSPACE_V1 } from "@/lib/features";
import { loadTeacherWorkspaceCapability } from "@/lib/api/class-lms/teacher-workspace-capability";

export const metadata = {
  title: "Dashboard",
};

async function DashboardPayload() {
  const [supabase, cookieStore] = await Promise.all([
    createClient(),
    cookies(),
  ]);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const activeUserId = user.id;
  const timezone = cookieStore.get("thinkfy_timezone")?.value;
  const subject = coerceSubject(cookieStore.get(SUBJECT_COOKIE_NAME)?.value);
  const now = new Date();
  const data = await getDashboardData(activeUserId, supabase, {
    timezone,
    subject,
    now,
  });
  const greetingKey = getTimeGreetingKey(now, timezone);

  // Get preferences for welcome banner check
  const profile = data.profile;

  // The organization membership is the source of truth for instructional
  // personas. Owners and organization admins retain an explicit mode switch;
  // assigned teachers and Head Teachers enter their workbench directly.
  if (TEACHER_WORKSPACE_V1) {
    let shouldAutoEnterTeacherWorkspace = false;
    try {
      const teacherCapability = await loadTeacherWorkspaceCapability();
      shouldAutoEnterTeacherWorkspace = teacherCapability.shouldAutoEnter;
    } catch {
      // Dashboard remains usable when the optional workspace projection fails.
    }
    if (shouldAutoEnterTeacherWorkspace) redirect("/dashboard/teacher");
  }

  const displayName =
    profile?.display_name ||
    user?.user_metadata?.display_name ||
    user?.email?.split("@")[0] ||
    "Debater";

  // Check if first dashboard visit after onboarding
  const prefs = (profile?.preferences as Record<string, unknown>) ?? {};
  const showWelcome = prefs.first_dashboard_visit === true;

  return (
    <DashboardContent
      data={data}
      displayName={displayName}
      greetingKey={greetingKey}
      userId={activeUserId}
      showWelcome={showWelcome}
    />
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<StudentRouteSkeleton variant="dashboard" />}>
      <DashboardPayload />
    </Suspense>
  );
}
