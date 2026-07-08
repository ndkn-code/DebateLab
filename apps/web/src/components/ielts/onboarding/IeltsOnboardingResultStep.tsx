import { useLocale, useTranslations } from "next-intl";
import { ArrowRight } from "@/components/ui/icons";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  IELTS_SKILLS,
  type IeltsBandPrediction,
  type IeltsGoalModel,
} from "@/lib/ielts/adaptive/contracts";
import { BandGauge, BandMeter } from "@/components/ielts/band-visuals";
import type { IeltsDiagnosticTestSummary } from "@/lib/api/ielts/study-plan-repository";
import { targetBandForSkill, type IeltsBandTargets } from "@/lib/ielts/band-visuals";
import {
  confidencePercent,
  predictionHasOverallEvidence,
} from "@/lib/ielts/onboarding/model";
import { formatBand } from "@/lib/ielts/learner/summary";
import { cn } from "@/lib/utils";
import type { PlanResult } from "./types";

function bandRange(prediction: IeltsBandPrediction): string {
  if (prediction.overall.lower === null || prediction.overall.upper === null) {
    return "pending";
  }
  return `${formatBand(prediction.overall.lower)}-${formatBand(prediction.overall.upper)}`;
}

export function IeltsOnboardingResultStep({
  isPending,
  hasPrediction,
  goal,
  prediction,
  planResult,
  diagnosticTest,
  diagnosticHref,
}: {
  isPending: boolean;
  hasPrediction: boolean;
  goal: IeltsGoalModel;
  prediction: IeltsBandPrediction;
  planResult: PlanResult | null;
  diagnosticTest: IeltsDiagnosticTestSummary | null;
  diagnosticHref: string | null;
}) {
  const t = useTranslations("ielts.onboarding");
  const locale = useLocale();
  const todayItems = planResult?.generatedPlan.today.slice(0, 4) ?? [];
  const targets: IeltsBandTargets = {
    overall: goal.targetOverallBand,
    skills: goal.targetSkillBands,
  };
  const confidence = confidencePercent(prediction.overall.confidence);

  return (
    <section className="grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
      <div>
        <h2 className="type-heading-lg font-bold text-on-surface">
          {t("result_title")}
        </h2>
        <p className="mt-2 type-body text-on-surface-variant">
          {hasPrediction ? t("result_body") : t("result_waiting_body")}
        </p>
      </div>
      <div className="grid gap-4">
        {isPending && !planResult ? (
          <div className="rounded-lg border border-outline-variant bg-surface-container p-5">
            <p className="type-body font-semibold text-on-surface">
              {t("generating_plan")}
            </p>
          </div>
        ) : null}

        <div className="grid gap-3 rounded-lg border border-outline-variant bg-surface-container p-5">
          <p className="type-body-sm font-semibold uppercase text-primary">
            {t("prediction_card")}
          </p>
          {predictionHasOverallEvidence(prediction) &&
          prediction.overall.band !== null ? (
            <div className="grid gap-3">
              <BandGauge
                band={prediction.overall.band}
                caption={
                  <span className="flex flex-col gap-1">
                    <span>{t("range", { range: bandRange(prediction) })}</span>
                    <span>{t("confidence", { count: confidence })}</span>
                  </span>
                }
                label={t("predicted_overall")}
                target={targets.overall}
              />
              <div className="grid gap-2 sm:grid-cols-2">
                {IELTS_SKILLS.map((skill) => (
                  <BandMeter
                    accent={skill}
                    band={prediction.skills[skill].band}
                    delayMs={IELTS_SKILLS.indexOf(skill) * 70}
                    key={skill}
                    skill={t(`skills.${skill}`)}
                    target={targetBandForSkill(targets, skill)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="type-body font-semibold text-on-surface">
                {t("no_prediction_title")}
              </p>
              <p className="type-body-sm text-on-surface-variant">
                {prediction.nextBestDiagnostic.reasonEn}
              </p>
              {diagnosticTest && diagnosticHref ? (
                <Link
                  href={diagnosticHref}
                  className={cn(buttonVariants({ variant: "primary" }))}
                >
                  {t("start_diagnostic")}
                  <ArrowRight className="size-4" />
                </Link>
              ) : null}
            </div>
          )}
          {!hasPrediction ? (
            <p className="type-caption text-on-surface-variant">
              {t("confidence", { count: confidence })}
            </p>
          ) : null}
        </div>

        {planResult ? (
          <div className="grid gap-3 rounded-lg border border-outline-variant bg-surface-container p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="type-body-sm font-semibold uppercase text-primary">
                {t("today_preview")}
              </p>
              <p className="type-caption text-on-surface-variant">
                {t("persisted_count", {
                  count: planResult.persistedItemCount,
                })}
              </p>
            </div>
            {todayItems.length > 0 ? (
              <div className="grid gap-2">
                {todayItems.map((item) => (
                  <div
                    key={item.tempId}
                    className="grid gap-1 rounded-lg bg-surface-container-low px-3 py-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="type-body-sm font-semibold text-on-surface">
                        {locale === "vi" ? item.titleVi : item.titleEn}
                      </p>
                      <span className="type-caption text-on-surface-variant">
                        {t("minutes", { count: item.estimatedMinutes })}
                      </span>
                    </div>
                    <p className="type-caption text-on-surface-variant">
                      {locale === "vi" ? item.rationaleVi : item.rationaleEn}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="type-body-sm text-on-surface-variant">
                {t("today_empty")}
              </p>
            )}
            <Link
              href="/ielts"
              className={cn(buttonVariants({ variant: "primary", size: "lg" }))}
            >
              {t("finish")}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}
