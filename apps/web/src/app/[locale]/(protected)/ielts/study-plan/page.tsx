import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createTypedServerClient } from "@/lib/supabase/server";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import { StudentRouteSkeleton } from "@/components/shared/student-route-skeleton";
import { IeltsStudyPlanView } from "@/components/ielts/study-plan/IeltsStudyPlanView";
import { getIeltsStudyPlanPageData } from "@/lib/api/ielts/study-plan-page-repository";
import { buildIeltsStudyPlanPageView } from "@/lib/ielts/study-plan/page-view";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";

export const metadata = {
  title: "IELTS study plan",
};

export const dynamic = "force-dynamic";

async function IeltsStudyPlanPayload({ locale }: { locale: string }) {
  const supabase = await createTypedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const devAuthBypassUser = user
    ? null
    : await getDevAuthBypassUserFromServerContext();

  if (!user && !devAuthBypassUser) {
    redirect("/auth/login");
  }

  const userId = user?.id ?? devAuthBypassUser?.id;
  if (!userId) redirect("/auth/login");

  const client = devAuthBypassUser ? createTypedAdminClient() : supabase;
  const data = await getIeltsStudyPlanPageData(userId, client);
  const view = buildIeltsStudyPlanPageView({
    plan: data.plan,
    goal: data.goal,
    items: data.items,
    reviews: data.reviews,
    revisions: data.revisions,
    prediction: data.prediction,
    todayIso: data.todayIso,
    now: data.now,
    hasDiagnosticTest: Boolean(data.diagnosticTest),
  });

  const returnTo = `/${locale}/ielts/study-plan`;
  const diagnosticHref = data.diagnosticTest
    ? `/ielts/mock/${data.diagnosticTest.slug}?returnTo=${encodeURIComponent(returnTo)}`
    : null;

  return <IeltsStudyPlanView view={view} diagnosticHref={diagnosticHref} />;
}

export default async function IeltsStudyPlanPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  return (
    <Suspense fallback={<StudentRouteSkeleton variant="dashboard" />}>
      <IeltsStudyPlanPayload locale={locale} />
    </Suspense>
  );
}
