import { useLocale, useTranslations } from "next-intl";
import { History } from "@/components/ui/icons";
import type { IeltsStudyPlanPageView } from "@/lib/ielts/study-plan/page-view";
import { SectionCard, formatShortDate, humanizeKey, pickText } from "./shared";

export function StudyPlanRevisionLog({ view }: { view: IeltsStudyPlanPageView }) {
  const t = useTranslations("ielts.studyPlan");
  const locale = useLocale();
  const { revisions } = view;

  return (
    <SectionCard
      icon={History}
      title={t("revisions_title")}
      caption={t("revisions_caption")}
    >
      {revisions.length === 0 ? (
        <p className="rounded-xl bg-surface-container-low px-4 py-6 text-center type-body-sm text-on-surface-variant">
          {t("revisions_empty")}
        </p>
      ) : (
        <ol className="grid gap-4 border-l border-outline-variant pl-5">
          {revisions.map((revision) => (
            <li key={revision.id} className="relative">
              <span className="absolute -left-[27px] top-1 size-3 rounded-full border-2 border-surface-container bg-primary" />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="type-caption font-semibold text-on-surface-variant">
                  {revision.fromVersion
                    ? t("revision_version", {
                        from: revision.fromVersion,
                        to: revision.toVersion,
                      })
                    : t("revision_version_initial", { to: revision.toVersion })}
                </span>
                <span className="type-caption text-on-surface-variant">
                  {formatShortDate(revision.createdAt, locale)}
                </span>
              </div>
              <p className="mt-1 type-body-sm font-medium text-on-surface">
                {pickText(locale, revision.summaryEn, revision.summaryVi)}
              </p>
              <p className="mt-0.5 type-caption text-on-surface-variant">
                {humanizeKey(revision.triggerType)} ·{" "}
                {t("revision_changed", { count: revision.changedItemCount })}
              </p>
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}
