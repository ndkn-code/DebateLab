"use client";

/**
 * One reviewed question: number chip, prompt, the learner's answer vs the
 * key, a correct/incorrect badge, the locale-preferred explanation, and a
 * "show in passage" jump when the answer was located in the source text.
 */
import { useLocale, useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin } from "@/components/ui/icons";
import type { ObjectiveReviewItem } from "@/lib/ielts/results/types";
import { cn } from "@/lib/utils";
import { useReviewSourceController } from "./review-source-context";

/** Locale-preferred explanation, falling back to the other language. */
export function explanationFor(
  item: Pick<ObjectiveReviewItem, "explanationEn" | "explanationVi">,
  locale: string,
): string | null {
  return locale === "vi"
    ? (item.explanationVi ?? item.explanationEn)
    : (item.explanationEn ?? item.explanationVi);
}

export function VerdictBadge({ isCorrect }: { isCorrect: boolean }) {
  const t = useTranslations("ielts.results.review");
  return isCorrect ? (
    <Badge variant="success" className="shrink-0">
      {t("correct")}
    </Badge>
  ) : (
    <Badge variant="outline" className="shrink-0 border-transparent bg-error-container text-error">
      {t("incorrect")}
    </Badge>
  );
}

export function AnswerLines({ item }: { item: ObjectiveReviewItem }) {
  const t = useTranslations("ielts.results.review");
  return (
    <dl className="flex flex-col gap-1 type-body-sm">
      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
        <dt className="text-on-surface-variant">{t("yourAnswer")}</dt>
        <dd
          className={cn(
            "font-medium",
            !item.answered
              ? "text-on-surface-variant"
              : item.isCorrect
                ? "text-on-surface"
                : "text-error",
          )}
        >
          {item.answered ? item.learnerAnswer : t("noAnswer")}
        </dd>
      </div>
      <div className="flex flex-wrap gap-x-2 gap-y-0.5">
        <dt className="text-on-surface-variant">{t("correctAnswer")}</dt>
        <dd className="font-medium text-on-surface">{item.correctAnswer}</dd>
      </div>
    </dl>
  );
}

export function ReviewRow({
  item,
  showPrompt = true,
  instructions = null,
}: {
  item: ObjectiveReviewItem;
  showPrompt?: boolean;
  /** Group rubric, rendered once above the first row of a run. */
  instructions?: string | null;
}) {
  const locale = useLocale();
  const t = useTranslations("ielts.results.review");
  const { jumpTo } = useReviewSourceController();
  const explanation = explanationFor(item, locale);

  return (
    <li className="flex flex-col gap-2">
      {instructions ? (
        <p className="px-1 type-body-sm text-on-surface-variant">{instructions}</p>
      ) : null}
      <div
        id={`review-q-${item.questionId}`}
        className="flex items-start gap-3 rounded-xl border border-outline-variant bg-surface p-3 sm:p-4"
      >
        <Badge variant="outline" className="shrink-0 tabular-nums">
          {item.numberLabel}
        </Badge>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {showPrompt && item.prompt ? (
            <p className="type-body-sm text-on-surface">{item.prompt}</p>
          ) : null}
          <AnswerLines item={item} />
          {explanation ? (
            <div className="rounded-lg bg-surface-container-low px-3 py-2">
              <p className="type-caption font-semibold uppercase text-on-surface-variant">
                {t("explanation")}
              </p>
              <p className="mt-0.5 type-body-sm text-on-surface-variant">
                {explanation}
              </p>
            </div>
          ) : null}
          {item.sourceRange ? (
            <div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => jumpTo(item.questionId, item.audioTimestamp)}
              >
                <MapPin aria-hidden="true" />
                {t("jumpTo")}
              </Button>
            </div>
          ) : null}
        </div>
        <VerdictBadge isCorrect={item.isCorrect} />
      </div>
    </li>
  );
}
