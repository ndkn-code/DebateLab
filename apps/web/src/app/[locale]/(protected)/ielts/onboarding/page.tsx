import { Suspense } from "react";
import { redirect } from "next/navigation";
import { createTypedServerClient } from "@/lib/supabase/server";
import { createTypedAdminClient } from "@/lib/supabase/admin";
import { StudentRouteSkeleton } from "@/components/shared/student-route-skeleton";
import { IeltsOnboardingFlow } from "@/components/ielts/onboarding/IeltsOnboardingFlow";
import {
  findQuickDiagnosticTest,
  loadActiveIeltsStudyPlan,
} from "@/lib/api/ielts/study-plan-repository";
import { loadIeltsBandPrediction } from "@/lib/api/ielts/band-prediction-repository";
import {
  DEFAULT_IELTS_TARGET_BAND,
} from "@/lib/ielts/adaptive/contracts";
import {
  defaultIeltsOnboardingGoal,
  goalFromStudyPlanRow,
  initialOnboardingStep,
} from "@/lib/ielts/onboarding/model";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";

export const metadata = {
  title: "IELTS onboarding",
};

export const dynamic = "force-dynamic";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function IeltsOnboardingPayload({
  locale,
  requestedStep,
}: {
  locale: string;
  requestedStep?: string;
}) {
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

  const ieltsClient = devAuthBypassUser ? createTypedAdminClient() : supabase;
  const [activePlan, diagnosticTest] = await Promise.all([
    loadActiveIeltsStudyPlan(userId, ieltsClient),
    findQuickDiagnosticTest(ieltsClient),
  ]);
  const targetBand =
    activePlan?.plan.target_overall_band ?? DEFAULT_IELTS_TARGET_BAND;
  const prediction = await loadIeltsBandPrediction(userId, {
    targetBand,
    client: ieltsClient,
  });
  const initialGoal = activePlan
    ? goalFromStudyPlanRow(activePlan.plan)
    : defaultIeltsOnboardingGoal({
        todayIso: todayIso(),
        timezone:
          Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Ho_Chi_Minh",
        feedbackLanguage: locale === "vi" ? "vi" : "en",
      });
  const returnTo = `/${locale}/ielts/onboarding?step=result`;
  const diagnosticHref = diagnosticTest
    ? `/ielts/mock/${diagnosticTest.slug}?returnTo=${encodeURIComponent(returnTo)}`
    : null;

  return (
    <IeltsOnboardingFlow
      initialStep={initialOnboardingStep({
        hasGoal: Boolean(activePlan),
        prediction,
        requestedStep,
      })}
      initialGoal={initialGoal}
      initialPrediction={prediction}
      diagnosticTest={diagnosticTest}
      diagnosticHref={diagnosticHref}
    />
  );
}

export default async function IeltsOnboardingPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ step?: string }>;
}) {
  const { locale } = await params;
  const { step } = await searchParams;
  return (
    <Suspense fallback={<StudentRouteSkeleton variant="dashboard" />}>
      <IeltsOnboardingPayload locale={locale} requestedStep={step} />
    </Suspense>
  );
}
