import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, CalendarClock, Target } from "@/components/ui/icons";
import { buttonVariants } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import type { IeltsStudyPlanPageView } from "@/lib/ielts/study-plan/page-view";
import { cn } from "@/lib/utils";
import {
  KindChip,
  SectionCard,
  SkillBadge,
  formatShortDate,
  pickText,
} from "./shared";

export function StudyPlanReassessment({
  view,
  diagnosticHref,
}: {
  view: IeltsStudyPlanPageView;
  diagnosticHref: string | null;
}) {
  const t = useTranslations("ielts.studyPlan");
  const locale = useLocale();
  const { reassessment } = view;

  return (
    <SectionCard
      icon={CalendarClock}
      title={t("reassessment_title")}
      caption={t("reassessment_caption")}
    >
      <div className="grid gap-3">
        <div className="flex items-center gap-2 rounded-xl bg-surface-container-low px-3 py-2.5">
          <Target className="size-4 shrink-0 text-primary" />
          <span className="type-body-sm text-on-surface-variant">
            {t("next_checkin")}:{" "}
            <span className="font-semibold text-on-surface">
              {reassessment.nextReassessmentAt
                ? formatShortDate(reassessment.nextReassessmentAt, locale)
                : t("no_checkin")}
            </span>
          </span>
        </div>

        {reassessment.mocks.length === 0 ? (
          <p className="type-body-sm text-on-surface-variant">{t("mocks_empty")}</p>
        ) : (
          <ul className="grid gap-2">
            {reassessment.mocks.map((mock) => (
              <li
                key={mock.id}
                className={cn(
                  "rounded-xl border border-outline-variant px-3 py-2",
                  mock.isPast ? "bg-surface-container" : "bg-surface-container-low",
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <KindChip kind={mock.kind} />
                    <SkillBadge skill={mock.skill} />
                  </div>
                  <span className="type-caption font-medium text-on-surface-variant">
                    {formatShortDate(mock.scheduledDate, locale)}
                  </span>
                </div>
                <p className="mt-1 type-caption text-on-surface-variant">
                  {pickText(locale, mock.rationaleEn, mock.rationaleVi)}
                </p>
              </li>
            ))}
          </ul>
        )}

        {diagnosticHref ? (
          <Link
            href={diagnosticHref}
            className={cn(buttonVariants({ variant: "secondary" }), "w-full sm:w-auto")}
          >
            {t("take_mock")}
            <ArrowRight className="size-4" />
          </Link>
        ) : null}
      </div>
    </SectionCard>
  );
}
