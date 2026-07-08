"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Eye,
  ListChecks,
} from "@/components/ui/icons";
import { buttonVariants } from "@/components/ui/button";
import { PageContainer, ProductPageShell } from "@/components/shared/product-layout";
import { PageTransition } from "@/components/shared/page-motion";
import { showToast } from "@/components/shared/toast";
import { cn } from "@/lib/utils";
import type {
  IeltsReviewRating,
  IeltsReviewSessionItemView,
  IeltsReviewSessionView,
} from "@/lib/ielts/review";
import { gradeIeltsReviewItemAction } from "@/app/actions/ielts/review";

const RATINGS: IeltsReviewRating[] = ["again", "hard", "good", "easy"];

function formatDueAt(value: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function BilingualBlock({
  label,
  en,
  vi,
}: {
  label: string;
  en: string | null;
  vi: string | null;
}) {
  return (
    <div className="grid gap-3">
      <p className="type-caption font-semibold uppercase text-on-surface-variant">
        {label}
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-outline-variant bg-surface px-4 py-3">
          <p className="type-caption font-semibold text-on-surface-variant">EN</p>
          <p className="mt-1 whitespace-pre-wrap type-body text-on-surface">
            {en || "—"}
          </p>
        </div>
        <div className="rounded-2xl border border-outline-variant bg-surface px-4 py-3">
          <p className="type-caption font-semibold text-on-surface-variant">VI</p>
          <p className="mt-1 whitespace-pre-wrap type-body text-on-surface">
            {vi || "—"}
          </p>
        </div>
      </div>
    </div>
  );
}

function ReviewCard({
  item,
  total,
  onGraded,
}: {
  item: IeltsReviewSessionItemView;
  total: number;
  onGraded: (reviewItemId: string) => void;
}) {
  const t = useTranslations("ielts.review");
  const locale = useLocale();
  const [revealed, setRevealed] = useState(false);
  const [saving, setSaving] = useState<IeltsReviewRating | null>(null);
  const [error, setError] = useState<string | null>(null);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    setRevealed(false);
    setSaving(null);
    setError(null);
    startedAt.current = Date.now();
  }, [item.id]);

  const dueLabel = useMemo(() => formatDueAt(item.dueAt, locale), [item.dueAt, locale]);

  async function grade(rating: IeltsReviewRating) {
    if (!revealed || saving) return;
    setSaving(rating);
    setError(null);
    try {
      await gradeIeltsReviewItemAction({
        reviewItemId: item.id,
        rating,
        responseMs: Math.max(0, Date.now() - startedAt.current),
      });
      showToast(
        item.position >= total ? t("toast_complete") : t("toast_saved"),
        "success",
      );
      onGraded(item.id);
    } catch {
      setError(t("grade_error"));
      showToast(t("grade_error"), "error");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="rounded-3xl border border-outline-variant bg-surface-container p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="type-eyebrow font-semibold uppercase text-primary">
            {t("card_progress", { current: item.position, total })}
          </p>
          <h1 className="mt-1 type-heading-lg font-bold text-on-surface">
            {t("title")}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 type-caption text-on-surface-variant">
          <span className="rounded-full bg-surface-container-high px-2.5 py-1 font-semibold">
            {t(`skill_${item.skill}`)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-high px-2.5 py-1">
            <Clock3 className="size-3.5" aria-hidden />
            {dueLabel}
          </span>
        </div>
      </div>

      <div className="mt-6 grid gap-5">
        <BilingualBlock
          label={t("prompt_label")}
          en={item.promptEn}
          vi={item.promptVi}
        />

        {revealed ? (
          <BilingualBlock
            label={t("answer_label")}
            en={item.answerEn}
            vi={item.answerVi}
          />
        ) : (
          <button
            type="button"
            onClick={() => setRevealed(true)}
            className={cn(buttonVariants({ variant: "primary" }), "self-start")}
          >
            <Eye className="size-4" />
            {t("reveal")}
          </button>
        )}

        {revealed ? (
          <div className="grid gap-3">
            <div>
              <h2 className="type-title font-semibold text-on-surface">
                {t("grade_title")}
              </h2>
              <p className="mt-1 type-body-sm text-on-surface-variant">
                {t("grade_body")}
              </p>
            </div>
            <div className="grid gap-2 sm:grid-cols-4">
              {RATINGS.map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => grade(rating)}
                  disabled={Boolean(saving)}
                  className={cn(
                    buttonVariants({ variant: rating === "again" ? "secondary" : "primary" }),
                    "justify-center",
                  )}
                >
                  {saving === rating ? t("saving") : t(`rating_${rating}`)}
                </button>
              ))}
            </div>
            {error ? (
              <p className="type-body-sm font-medium text-error">{error}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function IeltsReviewSession({ view }: { view: IeltsReviewSessionView }) {
  const t = useTranslations("ielts.review");
  const [items, setItems] = useState(view.items);
  const total = view.dueCount;
  const current = items[0] ?? null;

  return (
    <PageTransition>
      <ProductPageShell>
        <PageContainer size="focused" className="flex flex-col gap-6 py-6 lg:py-8">
          <Link
            href="/ielts"
            className="inline-flex items-center gap-1.5 self-start type-body-sm font-semibold text-on-surface-variant hover:text-on-surface"
          >
            <ArrowLeft className="size-4" />
            {t("back_home")}
          </Link>

          {current ? (
            <ReviewCard
              item={current}
              total={total}
              onGraded={(reviewItemId) =>
                setItems((existing) =>
                  existing
                    .filter((item) => item.id !== reviewItemId)
                    .map((item, index) => ({ ...item, position: index + 1 })),
                )
              }
            />
          ) : (
            <div className="rounded-3xl border border-outline-variant bg-surface-container p-8 text-center">
              <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary-container text-on-primary-container">
                {total > 0 ? (
                  <CheckCircle2 className="size-6" aria-hidden />
                ) : (
                  <ListChecks className="size-6" aria-hidden />
                )}
              </span>
              <h1 className="mt-4 type-heading-lg font-bold text-on-surface">
                {total > 0 ? t("done_title") : t("empty_title")}
              </h1>
              <p className="mx-auto mt-2 max-w-md type-body text-on-surface-variant">
                {total > 0 ? t("done_body") : t("empty_body")}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                <Link href="/ielts" className={cn(buttonVariants({ variant: "primary" }))}>
                  {t("cta_home")}
                </Link>
                <Link
                  href="/ielts/study-plan"
                  className={cn(buttonVariants({ variant: "secondary" }))}
                >
                  {t("cta_plan")}
                </Link>
              </div>
            </div>
          )}
        </PageContainer>
      </ProductPageShell>
    </PageTransition>
  );
}
