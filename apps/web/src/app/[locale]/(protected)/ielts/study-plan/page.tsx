import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createTypedServerClient } from "@/lib/supabase/server";
import { StudentRouteSkeleton } from "@/components/shared/student-route-skeleton";
import { IeltsStudyPlanView } from "@/components/ielts/study-plan/IeltsStudyPlanView";
import { getIeltsStudyPlanPageData } from "@/lib/api/ielts/study-plan-page-repository";
import { buildIeltsStudyPlanPageView } from "@/lib/ielts/study-plan/page-view";
import { ieltsPaths } from "@/lib/ielts/routes";

export const metadata = {
  title: "IELTS study plan",
};

export const dynamic = "force-dynamic";

async function IeltsStudyPlanPayload({ locale }: { locale: string }) {
  const supabase = await createTypedServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const client = supabase;
  const data = await getIeltsStudyPlanPageData(user.id, client);
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
    ? ieltsPaths.mock(data.diagnosticTest.slug, { returnTo })
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
