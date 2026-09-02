"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ProductIcon } from "@/components/ui/product-icon";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import {
  PageContainer,
  ProductPageShell,
} from "@/components/shared/product-layout";
import { IeltsEmptyState } from "@/components/ielts/learner/EmptyState";
import type { IeltsTestCard } from "@/lib/ielts/learner/library";
import { ieltsPaths } from "@/lib/ielts/routes";
import { cn } from "@/lib/utils";

const GUIDE_STORAGE_KEY = "thinkfy:ielts:speaking-rehearsal-guide:v1";

function subscribeToGuide(onChange: () => void) {
  window.addEventListener(GUIDE_STORAGE_KEY, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(GUIDE_STORAGE_KEY, onChange);
    window.removeEventListener("storage", onChange);
  };
}

function guideIsOpen() {
  return window.localStorage.getItem(GUIDE_STORAGE_KEY) !== "dismissed";
}

function FirstUseGuide() {
  const t = useTranslations("dashboard.ielts.speaking_rehearsal");
  const open = useSyncExternalStore(subscribeToGuide, guideIsOpen, () => true);

  const setOpen = (next: boolean) => {
    if (next) {
      window.localStorage.removeItem(GUIDE_STORAGE_KEY);
    } else {
      window.localStorage.setItem(GUIDE_STORAGE_KEY, "dismissed");
    }
    window.dispatchEvent(new Event(GUIDE_STORAGE_KEY));
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 type-label font-semibold text-primary transition-colors hover:bg-primary-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <ProductIcon name="help" size="sm" aria-hidden="true" />
        {t("guide_reopen")}
      </button>
    );
  }

  return (
    <aside
      aria-labelledby="speaking-rehearsal-guide-title"
      className="flex flex-col gap-3 rounded-xl border border-primary/25 bg-primary-container/55 p-4 sm:flex-row sm:items-center"
    >
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface text-primary"
      >
        <ProductIcon name="micStage" size="md" weight="duotone" />
      </span>
      <div className="min-w-0 flex-1">
        <h2
          id="speaking-rehearsal-guide-title"
          className="type-title font-semibold"
        >
          {t("guide_title")}
        </h2>
        <p className="mt-1 type-body-sm text-on-surface-variant">
          {t("guide_body")}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg border border-outline-variant bg-surface px-3 type-label font-semibold transition-colors hover:bg-surface-container focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        {t("guide_dismiss")}
      </button>
    </aside>
  );
}

function RehearsalCard({ card }: { card: IeltsTestCard }) {
  const t = useTranslations("dashboard.ielts");
  const tr = useTranslations("dashboard.ielts.speaking_rehearsal");

  return (
    <article className="flex h-full flex-col rounded-xl border border-outline-variant bg-surface p-4 transition-colors hover:border-primary/45 sm:p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary-container text-primary"
        >
          <ProductIcon name="micStage" size="md" weight="duotone" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="type-title font-semibold text-on-surface">
            {card.title}
          </h3>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Badge variant="primary">{t(`kind_${card.kind}`)}</Badge>
            <Badge variant="secondary">{t(`module_${card.module}`)}</Badge>
            {card.durationMinutes ? (
              <span className="inline-flex min-h-5 items-center gap-1 type-caption font-semibold text-on-surface-variant">
                <ProductIcon name="clock" size="xs" aria-hidden="true" />
                {t("minutes", { count: card.durationMinutes })}
              </span>
            ) : null}
          </div>
        </div>
      </div>
      {card.description ? (
        <p className="mt-3 line-clamp-2 type-body-sm text-on-surface-variant">
          {card.description}
        </p>
      ) : null}
      <Link
        href={ieltsPaths.mock(card.slug, { experience: "speaking_rehearsal" })}
        className={cn(
          buttonVariants({ variant: "primary", size: "sm" }),
          "mt-4 w-full",
        )}
      >
        {tr("start")}
        <ProductIcon name="arrowRight" size="sm" weight="bold" />
      </Link>
    </article>
  );
}

export function SpeakingRehearsalLibrary({
  tests,
}: {
  tests: IeltsTestCard[];
}) {
  const t = useTranslations("dashboard.ielts.speaking_rehearsal");

  return (
    <ProductPageShell>
      <PageContainer size="data" className="py-5 lg:py-6">
        <header className="flex flex-col gap-4 border-b border-outline-variant pb-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="type-label font-semibold uppercase tracking-widest text-primary">
              {t("eyebrow")}
            </p>
            <h1 className="mt-1 type-heading-lg font-semibold text-on-surface md:type-heading-xl">
              {t("title")}
            </h1>
            <p className="mt-2 type-body text-on-surface-variant">
              {t("body")}
            </p>
          </div>
          <FirstUseGuide />
        </header>

        <section
          aria-labelledby="speaking-rehearsal-notice-title"
          className="mt-5 flex gap-3 rounded-xl border border-warning/25 bg-warning-container/55 p-4"
        >
          <ProductIcon
            name="info"
            size="md"
            weight="duotone"
            className="mt-0.5 shrink-0 text-warning"
            aria-hidden="true"
          />
          <div>
            <h2
              id="speaking-rehearsal-notice-title"
              className="type-title font-semibold"
            >
              {t("notice_title")}
            </h2>
            <p className="mt-1 type-body-sm text-on-surface-variant">
              {t("notice_body")}
            </p>
          </div>
        </section>

        <section
          aria-labelledby="speaking-rehearsal-list-title"
          className="mt-5"
        >
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
            <h2
              id="speaking-rehearsal-list-title"
              className="type-title font-semibold"
            >
              {t("available_title")}
            </h2>
            <p className="type-label text-on-surface-variant">
              {t("available_count", { count: tests.length })}
            </p>
          </div>
          {tests.length === 0 ? (
            <IeltsEmptyState
              icon={<ProductIcon name="micStage" size="lg" weight="duotone" />}
              title={t("empty_title")}
              body={t("empty_body")}
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {tests.map((test) => (
                <RehearsalCard key={test.id} card={test} />
              ))}
            </div>
          )}
        </section>
      </PageContainer>
    </ProductPageShell>
  );
}
