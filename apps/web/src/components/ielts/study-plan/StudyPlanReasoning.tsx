import { useLocale, useTranslations } from "next-intl";
import {
  Info,
  Minus,
  Sparkles,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "@/components/ui/icons";
import { formatBand } from "@/lib/ielts/learner/summary";
import type { IeltsStudyPlanPageView } from "@/lib/ielts/study-plan/page-view";
import { cn } from "@/lib/utils";
import {
  SectionCard,
  SkillBadge,
  formatShortDate,
  pickText,
  severityClass,
} from "./shared";

const TREND_ICON: Record<string, LucideIcon> = {
  up: TrendingUp,
  down: TrendingDown,
  flat: Minus,
  unknown: Minus,
};

export function StudyPlanReasoning({ view }: { view: IeltsStudyPlanPageView }) {
  const t = useTranslations("ielts.studyPlan");
  const locale = useLocale();
  const { prediction, reasoning } = view;
  const TrendIcon = TREND_ICON[prediction.trendDirection] ?? Minus;
  const hasBand = prediction.overallBand !== null;
  const rationale = pickText(
    locale,
    reasoning.planRationaleEn ?? "",
    reasoning.planRationaleVi ?? "",
  );

  return (
    <SectionCard
      icon={Sparkles}
      title={t("reasoning_title")}
      caption={t("reasoning_caption")}
    >
      <div className="grid gap-5">
        <div className="grid gap-4 sm:grid-cols-[200px_1fr]">
          <div
            className={cn(
              "flex flex-col items-center justify-center rounded-2xl px-5 py-4 text-center",
              hasBand
                ? "bg-primary-container text-on-primary-container"
                : "bg-tertiary-container text-on-tertiary-container",
            )}
          >
            <span className="type-caption font-semibold uppercase">
              {t("predicted_overall")}
            </span>
            <span className="type-display font-bold tabular-nums">
              {hasBand ? formatBand(prediction.overallBand) : "—"}
            </span>
            {hasBand && prediction.lower !== null && prediction.upper !== null ? (
              <span className="type-caption">
                {t("range", {
                  range: `${formatBand(prediction.lower)}–${formatBand(prediction.upper)}`,
                })}
              </span>
            ) : (
              <span className="type-caption">{t("no_band")}</span>
            )}
            <span className="mt-1 type-caption">
              {t("confidence", { count: prediction.confidencePercent })}
            </span>
          </div>

          <div className="grid gap-2">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 type-body-sm text-on-surface-variant">
              <TrendIcon className="size-4" />
              <span className="font-semibold text-on-surface">
                {t(`trend.${prediction.trendDirection}`)}
              </span>
              <span>· {t("as_of", { date: formatShortDate(prediction.asOf, locale) })}</span>
            </div>
            <p className="type-caption font-semibold uppercase text-on-surface-variant">
              {t("gap_title")}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {prediction.skills.map((skill) => (
                <div
                  key={skill.skill}
                  className="flex items-center justify-between gap-2 rounded-xl bg-surface-container-low px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <SkillBadge skill={skill.skill} />
                    {skill.isFocus ? (
                      <span className="type-caption font-semibold text-primary">
                        {t("focus_tag")}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-right">
                    <p className="type-body-sm font-bold tabular-nums text-on-surface">
                      {formatBand(skill.predictedBand)}
                      <span className="font-medium text-on-surface-variant">
                        {" / "}
                        {formatBand(skill.targetBand)}
                      </span>
                    </p>
                    <p className="type-caption text-on-surface-variant">
                      {skill.gapBands === null
                        ? t("no_band")
                        : skill.gapBands <= 0
                          ? t("on_target")
                          : t("gap_band", { count: skill.gapBands })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {reasoning.weaknesses.length > 0 ? (
          <div className="grid gap-2">
            <p className="type-body-sm font-semibold text-on-surface">
              {t("weaknesses_title")}
            </p>
            <ul className="grid gap-2">
              {reasoning.weaknesses.map((weakness) => (
                <li
                  key={weakness.key}
                  className="rounded-xl border border-outline-variant bg-surface-container-low p-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <SkillBadge skill={weakness.skill} />
                      <span className="type-body-sm font-semibold text-on-surface">
                        {pickText(locale, weakness.labelEn, weakness.labelVi)}
                      </span>
                    </div>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 type-caption font-semibold",
                        severityClass(weakness.severity),
                      )}
                    >
                      {t(`severity.${weakness.severity}`)}
                    </span>
                  </div>
                  <p className="mt-1 type-body-sm text-on-surface-variant">
                    {pickText(locale, weakness.reasonEn, weakness.reasonVi)}
                  </p>
                  {weakness.currentBand !== null && weakness.targetBand !== null ? (
                    <p className="mt-1 type-caption font-medium text-on-surface-variant">
                      {t("weakness_now_target", {
                        current: formatBand(weakness.currentBand),
                        target: formatBand(weakness.targetBand),
                      })}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {rationale ? (
          <div className="flex gap-3 rounded-xl bg-surface-container-low p-4">
            <Info className="size-5 shrink-0 text-primary" />
            <div>
              <p className="type-body-sm font-semibold text-on-surface">
                {t("rationale_title")}
              </p>
              <p className="mt-1 type-body-sm text-on-surface-variant">{rationale}</p>
            </div>
          </div>
        ) : null}

        {reasoning.limitations.length > 0 ? (
          <div className="grid gap-1">
            <p className="type-caption font-semibold uppercase text-on-surface-variant">
              {t("limitations_title")}
            </p>
            <ul className="grid gap-1">
              {reasoning.limitations.map((limitation) => (
                <li
                  key={limitation}
                  className="flex gap-2 type-caption text-on-surface-variant"
                >
                  <span aria-hidden>•</span>
                  {limitation}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
