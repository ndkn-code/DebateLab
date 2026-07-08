"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  PageContainer,
  ProductPageShell,
} from "@/components/shared/product-layout";
import { PageTransition } from "@/components/shared/page-motion";
import { showToast } from "@/components/shared/toast";
import {
  generateIeltsOnboardingPlanAction,
  saveIeltsOnboardingGoalAction,
} from "@/app/actions/ielts/onboarding";
import type {
  IeltsBandPrediction,
  IeltsGoalModel,
} from "@/lib/ielts/adaptive/contracts";
import type { IeltsDiagnosticTestSummary } from "@/lib/api/ielts/study-plan-repository";
import {
  predictionHasOverallEvidence,
  type IeltsOnboardingStep,
} from "@/lib/ielts/onboarding/model";
import { IeltsOnboardingDiagnosticStep } from "./IeltsOnboardingDiagnosticStep";
import { IeltsOnboardingGoalStep } from "./IeltsOnboardingGoalStep";
import { IeltsOnboardingResultStep } from "./IeltsOnboardingResultStep";
import { OnboardingHeader } from "./IeltsOnboardingShared";
import { IeltsOnboardingWelcome } from "./IeltsOnboardingWelcome";
import {
  goalToState,
  stateToGoal,
  type PlanResult,
} from "./types";

export function IeltsOnboardingFlow({
  initialStep,
  initialGoal,
  initialPrediction,
  diagnosticTest,
  diagnosticHref,
}: {
  initialStep: IeltsOnboardingStep;
  initialGoal: IeltsGoalModel;
  initialPrediction: IeltsBandPrediction;
  diagnosticTest: IeltsDiagnosticTestSummary | null;
  diagnosticHref: string | null;
}) {
  const t = useTranslations("ielts.onboarding");
  const locale = useLocale();
  const [step, setStep] = useState<IeltsOnboardingStep>(initialStep);
  const [goal, setGoal] = useState(() => goalToState(initialGoal));
  const [availableDiagnostic, setAvailableDiagnostic] = useState(diagnosticTest);
  const [planResult, setPlanResult] = useState<PlanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const hasRequestedPlan = useRef(false);

  const activeDiagnosticHref = useMemo(() => {
    if (!availableDiagnostic) return diagnosticHref;
    const returnTo = `/${locale}/ielts/onboarding?step=result`;
    return `/ielts/mock/${availableDiagnostic.slug}?returnTo=${encodeURIComponent(returnTo)}`;
  }, [availableDiagnostic, diagnosticHref, locale]);

  const resultPrediction = planResult?.prediction ?? initialPrediction;
  const resultGoal = useMemo(() => stateToGoal(goal), [goal]);
  const hasPrediction =
    planResult !== null
      ? predictionHasOverallEvidence(planResult.prediction)
      : predictionHasOverallEvidence(initialPrediction);

  useEffect(() => {
    if (step !== "result" || planResult || isPending || hasRequestedPlan.current) {
      return;
    }
    hasRequestedPlan.current = true;
    startTransition(async () => {
      setError(null);
      try {
        const result = await generateIeltsOnboardingPlanAction();
        setPlanResult(result);
        setAvailableDiagnostic(result.diagnosticTest);
        showToast(t("toast_plan_ready"), "success");
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : t("error_generic");
        setError(message);
        showToast(message, "error");
      }
    });
  }, [isPending, planResult, step, t]);

  const saveGoal = () => {
    startTransition(async () => {
      setError(null);
      try {
        const result = await saveIeltsOnboardingGoalAction(stateToGoal(goal));
        setAvailableDiagnostic(result.diagnosticTest);
        setStep("diagnostic");
        showToast(t("toast_goal_saved"), "success");
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : t("error_generic");
        setError(message);
        showToast(message, "error");
      }
    });
  };

  return (
    <PageTransition>
      <ProductPageShell>
        <PageContainer size="wide" className="flex flex-col gap-6 py-6 lg:py-8">
          <OnboardingHeader step={step} />

          {error ? (
            <p className="rounded-lg bg-error-container px-4 py-3 type-body-sm font-medium text-error">
              {error}
            </p>
          ) : null}

          {step === "welcome" ? (
            <IeltsOnboardingWelcome onContinue={() => setStep("goal")} />
          ) : null}

          {step === "goal" ? (
            <IeltsOnboardingGoalStep
              goal={goal}
              setGoal={setGoal}
              isPending={isPending}
              onBack={() => setStep("welcome")}
              onSubmit={saveGoal}
            />
          ) : null}

          {step === "diagnostic" ? (
            <IeltsOnboardingDiagnosticStep
              diagnosticTest={availableDiagnostic}
              diagnosticHref={activeDiagnosticHref}
            />
          ) : null}

          {step === "result" ? (
            <IeltsOnboardingResultStep
              isPending={isPending}
              hasPrediction={hasPrediction}
              goal={resultGoal}
              prediction={resultPrediction}
              planResult={planResult}
              diagnosticTest={availableDiagnostic}
              diagnosticHref={activeDiagnosticHref}
            />
          ) : null}
        </PageContainer>
      </ProductPageShell>
    </PageTransition>
  );
}
