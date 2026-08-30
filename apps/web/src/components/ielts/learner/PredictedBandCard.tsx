"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ArrowRight,
  Minus,
  TrendingDown,
  TrendingUp,
} from "@/components/ui/icons";
import { buttonVariants } from "@/components/ui/button";
import { BandMeter } from "@/components/ielts/band-visuals";
import { cn } from "@/lib/utils";
import { formatBand } from "@/lib/ielts/learner/summary";
import type {
  IeltsPredictionCardView,
  IeltsPredictionSkillRow,
} from "@/lib/ielts/home/prediction-card";
import type { IeltsHomePlanSummary } from "@/lib/ielts/home/plan-summary";

const CONFIDENCE_LEVEL: Record<
  IeltsPredictionCardView["overall"]["status"],
  "low" | "medium" | "high"
> = {
  diagnostic_needed: "low",
  low_confidence: "low",
  medium_confidence: "medium",
  high_confidence: "high",
};

function Trend({ direction }: { direction: IeltsPredictionSkillRow["trend"] }) {
  const t = useTranslations("dashboard.ielts");
  if (direction === "unknown") return null;
  const Icon =
    direction === "up"
      ? TrendingUp
      : direction === "down"
        ? TrendingDown
        : Minus;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 type-caption font-medium",
        direction === "up"
          ? "text-success"
          : direction === "down"
            ? "text-error"
            : "text-on-surface-variant",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {t(`trend_${direction}`)}
    </span>
  );
}

function SkillStatus({ row }: { row: IeltsPredictionSkillRow }) {
  const t = useTranslations("dashboard.ielts");
  return row.hasEvidence ? (
    <Trend direction={row.trend} />
  ) : (
    <span className="type-caption text-on-surface-variant">
      {t("skill_no_evidence")}
    </span>
  );
}

function Countdown({
  planSummary,
}: {
  planSummary: IeltsHomePlanSummary | null;
}) {
  const t = useTranslations("dashboard.ielts");
  const days = planSummary?.testDateInDays;
  if (days === null || days === undefined) return null;
  const label =
    days < 0
      ? t("test_passed")
      : days === 0
        ? t("test_today")
        : t("test_countdown", { days });
  return (
    <span className="rounded-md bg-surface-container-high px-2 py-1 type-caption font-medium text-on-surface-variant">
      {label}
    </span>
  );
}

export function PredictedBandCard({
  view,
  planSummary,
  diagnosticReady,
}: {
  view: IeltsPredictionCardView;
  planSummary: IeltsHomePlanSummary | null;
  diagnosticReady: boolean;
}) {
  const t = useTranslations("dashboard.ielts");
  const locale = useLocale();

  if (view.isDiagnosticFirst) {
    const reason =
      (locale === "vi"
        ? view.nextBestDiagnostic.reasonVi
        : view.nextBestDiagnostic.reasonEn) || t("hero_diagnostic_first");
    return (
      <section className="rounded-xl border border-outline-variant bg-surface-container p-4">
        <p className="type-eyebrow font-semibold uppercase text-primary">
          {t("predicted_title")}
        </p>
        <h2 className="mt-1 type-title font-semibold text-on-surface">
          {t("predicted_diagnostic_title")}
        </h2>
        <p className="mt-1.5 type-body-sm text-on-surface-variant">{reason}</p>
        <Link
          href="/ielts/onboarding"
          className={cn(buttonVariants({ variant: "primary" }), "mt-4 w-full")}
        >
          {diagnosticReady ? t("cta_start_diagnostic") : t("cta_view_plan")}
          <ArrowRight className="size-4" aria-hidden />
        </Link>
      </section>
    );
  }

  const overall = view.overall;
  const confidence = t(`confidence_level_${CONFIDENCE_LEVEL[overall.status]}`);

  return (
    <section className="rounded-xl border border-outline-variant bg-surface-container p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="type-caption font-medium text-on-surface-variant">
            {t("predicted_title")}
          </p>
          <p className="mt-0.5 type-heading-xl font-semibold tabular-nums text-on-surface">
            {overall.band?.toFixed(1) ?? "—"}
          </p>
        </div>
        <Countdown planSummary={planSummary} />
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 type-caption text-on-surface-variant">
        <span>
          {t("target_band_label", { band: formatBand(overall.targetBand) })}
        </span>
        <span aria-hidden>·</span>
        <span>{confidence}</span>
        <span aria-hidden>·</span>
        <span>
          {t("prediction_confidence", { count: overall.confidencePercent })}
        </span>
      </div>

      <div className="mt-4 border-t border-outline-variant pt-3">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h2 className="type-label font-semibold text-on-surface">
            {t("per_skill_title")}
          </h2>
          <Trend direction={overall.trend} />
        </div>
        <div className="grid gap-2">
          {view.skills.map((row) => (
            <BandMeter
              accent={row.skill}
              band={row.band}
              className="bg-surface-container-low"
              key={row.skill}
              skill={t(`skill_${row.skill}`)}
              status={<SkillStatus row={row} />}
              target={overall.targetBand}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
