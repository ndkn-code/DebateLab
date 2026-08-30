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
import { DEFAULT_IELTS_TARGET_BAND } from "@/lib/ielts/adaptive/contracts";
import {
  defaultIeltsOnboardingGoal,
  goalFromStudyPlanRow,
  initialOnboardingStep,
  selfReportedBandFromPreferences,
} from "@/lib/ielts/onboarding/model";
import { getDevAuthBypassUserFromServerContext } from "@/lib/dev-auth-bypass";

export const metadata = {
  title: "IELTS onboarding",
};

export const dynamic = "force-dynamic";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

async function loadDevBypassUser(hasAuthenticatedUser: boolean) {
  if (hasAuthenticatedUser) return null;
  return getDevAuthBypassUserFromServerContext();
}

function initialGoalFor(
  activePlan: Awaited<ReturnType<typeof loadActiveIeltsStudyPlan>>,
  locale: string,
) {
  if (activePlan) return goalFromStudyPlanRow(activePlan.plan);
  return defaultIeltsOnboardingGoal({
    todayIso: todayIso(),
    timezone:
      Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Ho_Chi_Minh",
    feedbackLanguage: locale === "vi" ? "vi" : "en",
  });
}

function diagnosticHrefFor(
  slug: string | undefined,
  locale: string,
): string | null {
  if (!slug) return null;
  const returnTo = `/${locale}/ielts/onboarding?step=result`;
  return `/ielts/mock/${slug}?returnTo=${encodeURIComponent(returnTo)}`;
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
  const devAuthBypassUser = await loadDevBypassUser(Boolean(user));

  if (!user && !devAuthBypassUser) {
    redirect("/auth/login");
  }

  const userId = user?.id ?? devAuthBypassUser?.id;
  if (!userId) redirect("/auth/login");

  const ieltsClient = devAuthBypassUser ? createTypedAdminClient() : supabase;
  const [activePlan, diagnosticTest, profileResult] = await Promise.all([
    loadActiveIeltsStudyPlan(userId, ieltsClient),
    findQuickDiagnosticTest(ieltsClient),
    ieltsClient
      .from("profiles")
      .select("preferences")
      .eq("id", userId)
      .maybeSingle(),
  ]);
  if (profileResult.error) throw new Error(profileResult.error.message);
  const targetBand =
    activePlan?.plan.target_overall_band ?? DEFAULT_IELTS_TARGET_BAND;
  const prediction = await loadIeltsBandPrediction(userId, {
    targetBand,
    client: ieltsClient,
  });
  const initialGoal = initialGoalFor(activePlan, locale);
  const diagnosticHref = diagnosticHrefFor(diagnosticTest?.slug, locale);

  return (
    <IeltsOnboardingFlow
      initialStep={initialOnboardingStep({
        hasGoal: Boolean(activePlan),
        prediction,
        requestedStep,
      })}
      initialGoal={initialGoal}
      initialCurrentBand={selfReportedBandFromPreferences(
        profileResult.data?.preferences,
      )}
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
