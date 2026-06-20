"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRight, GraduationCap } from "@/components/ui/icons";
import { buttonVariants } from "@/components/ui/button";
import { PageTransition } from "@/components/shared/page-motion";
import {
  PageContainer,
  ProductPageShell,
} from "@/components/shared/product-layout";
import { cn } from "@/lib/utils";
import { formatBand, latestOverallBand } from "@/lib/ielts/learner/summary";
import type { IeltsHomeData } from "@/lib/api/ielts/learner-repository";
import { RecentAttempts } from "./RecentAttempts";
import { TestCard } from "./TestCard";
import { IeltsEmptyState } from "./EmptyState";

/**
 * IELTS learner home (WS-5.1). The connective surface a student lands on after
 * switching to the IELTS subject: a hero with their latest band, recent
 * sittings, and a teaser into the test library. Debate stays untouched — this
 * only renders when the active subject is `ielts` (gated by `IELTS_ENABLED`).
 */
export function IeltsHome({
  data,
  displayName,
}: {
  data: IeltsHomeData;
  displayName: string;
}) {
  const t = useTranslations("dashboard.ielts");
  const latest = latestOverallBand(data.recentAttempts);
  const hasTests = data.featuredTests.length > 0;
  const hasAttempts = data.recentAttempts.length > 0;

  return (
    <PageTransition>
      <ProductPageShell>
        <PageContainer size="wide" className="flex flex-col gap-8 py-6 lg:py-8">
          <section className="overflow-hidden rounded-3xl border border-outline-variant bg-surface-container p-6 sm:p-8">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="type-eyebrow font-semibold uppercase tracking-wide text-primary">
                  {t("eyebrow")}
                </p>
                <h1 className="mt-1 type-heading-xl font-bold text-balance text-on-surface">
                  {t("greeting", { name: displayName })}
                </h1>
                <p className="mt-2 max-w-prose type-body text-on-surface-variant">
                  {latest !== null ? t("hero_band_intro") : t("hero_empty")}
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/ielts/tests"
                    className={cn(buttonVariants({ variant: "primary" }))}
                  >
                    {t("cta_browse")}
                    <ArrowRight className="size-4" />
                  </Link>
                </div>
              </div>

              {latest !== null ? (
                <div className="flex shrink-0 flex-col items-center justify-center rounded-2xl bg-primary-container px-7 py-5 text-center">
                  <span className="type-caption font-semibold uppercase tracking-wide text-on-primary-container">
                    {t("overall_band")}
                  </span>
                  <span className="type-display font-bold tabular-nums text-on-primary-container">
                    {formatBand(latest)}
                  </span>
                </div>
              ) : null}
            </div>
          </section>

          {hasAttempts ? (
            <section className="flex flex-col gap-3">
              <h2 className="type-heading-md font-semibold text-on-surface">
                {t("recent_title")}
              </h2>
              <RecentAttempts items={data.recentAttempts} />
            </section>
          ) : null}

          <section className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="type-heading-md font-semibold text-on-surface">
                {t("featured_title")}
              </h2>
              {hasTests ? (
                <Link
                  href="/ielts/tests"
                  className="inline-flex items-center gap-1 type-body-sm font-semibold text-primary hover:underline"
                >
                  {t("view_all")}
                  <ArrowRight className="size-4" />
                </Link>
              ) : null}
            </div>

            {hasTests ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {data.featuredTests.map((card) => (
                  <TestCard key={card.id} card={card} />
                ))}
              </div>
            ) : (
              <IeltsEmptyState
                icon={<GraduationCap className="size-6" />}
                title={t("empty_tests_title")}
                body={t("empty_tests_body")}
              />
            )}
          </section>
        </PageContainer>
      </ProductPageShell>
    </PageTransition>
  );
}
