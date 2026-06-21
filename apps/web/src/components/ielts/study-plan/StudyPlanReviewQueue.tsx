import { useLocale, useTranslations } from "next-intl";
import { ListChecks } from "@/components/ui/icons";
import type {
  IeltsStudyPlanPageView,
  IeltsStudyPlanReviewView,
} from "@/lib/ielts/study-plan/page-view";
import {
  SectionCard,
  SkillBadge,
  formatShortDate,
  humanizeKey,
  pickText,
} from "./shared";

function ReviewRow({ review }: { review: IeltsStudyPlanReviewView }) {
  const t = useTranslations("ielts.studyPlan");
  const locale = useLocale();
  return (
    <li className="flex items-start justify-between gap-2 rounded-xl border border-outline-variant bg-surface-container-low px-3 py-2">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <SkillBadge skill={review.skill} />
          <span className="type-caption font-semibold text-on-surface-variant">
            {humanizeKey(review.reviewKind)}
          </span>
          {review.isOverdue ? (
            <span className="type-caption font-semibold text-error">
              {t("review_overdue")}
            </span>
          ) : null}
        </div>
        <p className="mt-1 truncate type-body-sm text-on-surface">
          {pickText(locale, review.promptEn, review.promptVi)}
        </p>
        <p className="truncate type-caption text-on-surface-variant">{review.focusArea}</p>
      </div>
      <span className="shrink-0 type-caption text-on-surface-variant">
        {t("review_due_on", { date: formatShortDate(review.dueAt, locale) })}
      </span>
    </li>
  );
}

function ReviewGroup({
  label,
  count,
  shown,
  reviews,
}: {
  label: string;
  count: number;
  shown: number;
  reviews: IeltsStudyPlanReviewView[];
}) {
  const t = useTranslations("ielts.studyPlan");
  return (
    <div className="grid gap-2">
      <p className="type-body-sm font-semibold text-on-surface">
        {label} · {count}
      </p>
      <ul className="grid gap-2">
        {reviews.map((review) => (
          <ReviewRow key={review.id} review={review} />
        ))}
      </ul>
      {count > shown ? (
        <p className="type-caption text-on-surface-variant">
          {t("reviews_more", { count: count - shown })}
        </p>
      ) : null}
    </div>
  );
}

export function StudyPlanReviewQueue({ view }: { view: IeltsStudyPlanPageView }) {
  const t = useTranslations("ielts.studyPlan");
  const { reviewQueue } = view;
  const isEmpty = reviewQueue.dueCount === 0 && reviewQueue.upcomingCount === 0;

  return (
    <SectionCard
      icon={ListChecks}
      title={t("reviews_title")}
      caption={t("reviews_caption")}
    >
      {isEmpty ? (
        <p className="rounded-xl bg-surface-container-low px-4 py-6 text-center type-body-sm text-on-surface-variant">
          {t("reviews_empty")}
        </p>
      ) : (
        <div className="grid gap-4">
          {reviewQueue.due.length > 0 ? (
            <ReviewGroup
              label={t("reviews_due")}
              count={reviewQueue.dueCount}
              shown={reviewQueue.due.length}
              reviews={reviewQueue.due}
            />
          ) : null}
          {reviewQueue.upcoming.length > 0 ? (
            <ReviewGroup
              label={t("reviews_upcoming")}
              count={reviewQueue.upcomingCount}
              shown={reviewQueue.upcoming.length}
              reviews={reviewQueue.upcoming}
            />
          ) : null}
        </div>
      )}
    </SectionCard>
  );
}
