import { useLocale, useTranslations } from "next-intl";
import { ArrowRight } from "@/components/ui/icons";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import {
  IELTS_SKILLS,
  type IeltsBandPrediction,
} from "@/lib/ielts/adaptive/contracts";
import type { IeltsDiagnosticTestSummary } from "@/lib/api/ielts/study-plan-repository";
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
  prediction,
  planResult,
  diagnosticTest,
  diagnosticHref,
}: {
  isPending: boolean;
  hasPrediction: boolean;
  prediction: IeltsBandPrediction;
  planResult: PlanResult | null;
  diagnosticTest: IeltsDiagnosticTestSummary | null;
  diagnosticHref: string | null;
}) {
  const t = useTranslations("ielts.onboarding");
  const locale = useLocale();
  const todayItems = planResult?.generatedPlan.today.slice(0, 4) ?? [];

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
            <div className="grid gap-4 sm:grid-cols-[180px_1fr]">
              <div className="rounded-lg bg-primary-container p-5 text-center text-on-primary-container">
                <p className="type-caption font-semibold uppercase">
                  {t("predicted_overall")}
                </p>
                <p className="type-display font-bold tabular-nums">
                  {formatBand(prediction.overall.band)}
                </p>
                <p className="type-caption">
                  {t("range", { range: bandRange(prediction) })}
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {IELTS_SKILLS.map((skill) => (
                  <div
                    key={skill}
                    className="rounded-lg bg-surface-container-low px-3 py-2"
                  >
                    <p className="type-caption font-semibold text-on-surface-variant">
                      {t(`skills.${skill}`)}
                    </p>
                    <p className="type-heading-sm font-bold text-on-surface">
                      {formatBand(prediction.skills[skill].band)}
                    </p>
                  </div>
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
          <p className="type-caption text-on-surface-variant">
            {t("confidence", {
              count: confidencePercent(prediction.overall.confidence),
            })}
          </p>
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
