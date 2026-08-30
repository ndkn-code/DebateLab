"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { ArrowRight, GraduationCap } from "@/components/ui/icons";
import { PageTransition } from "@/components/shared/page-motion";
import {
  PageContainer,
  ProductPageShell,
} from "@/components/shared/product-layout";
import { DEFAULT_IELTS_TARGET_BAND } from "@/lib/ielts/adaptive/contracts";
import { buildIeltsPredictionCardView } from "@/lib/ielts/home/prediction-card";
import type { IeltsHomeData } from "@/lib/api/ielts/learner-repository";
import { RecentAttempts } from "./RecentAttempts";
import { TestCard } from "./TestCard";
import { IeltsEmptyState } from "./EmptyState";
import { PredictedBandCard } from "./PredictedBandCard";
import { IeltsDailyLoopPanel } from "./IeltsDailyLoopPanel";
import { IeltsEntryTiles } from "./IeltsEntryTiles";

/**
 * IELTS learner home — the adaptive dashboard (WS-6.2.1). The surface a student
 * lands on after switching to the IELTS subject: a predicted-band card
 * (diagnostic-first until there's real evidence), a prioritized "Today" task
 * list that launches real items, entry tiles into the plan / Learn path / mock
 * library, then recent sittings and a test-library teaser. Debate stays
 * untouched — this only renders when the active subject is `ielts`
 * (gated by `IELTS_ENABLED`).
 */
export function IeltsHome({ data }: { data: IeltsHomeData }) {
  const t = useTranslations("dashboard.ielts");
  const targetBand =
    data.planSummary?.targetOverallBand ?? DEFAULT_IELTS_TARGET_BAND;
  const predictionView = buildIeltsPredictionCardView(data.prediction, {
    targetBand,
  });
  const diagnosticReady = Boolean(data.diagnosticTest);
  const totalMinutes = data.today.reduce(
    (sum, item) => sum + item.estimatedMinutes,
    0,
  );
  const hasTests = data.featuredTests.length > 0;
  const hasAttempts = data.recentAttempts.length > 0;

  return (
    <PageTransition>
      <ProductPageShell>
        <PageContainer size="data" className="flex flex-col gap-5 py-5 lg:py-6">
          <header className="flex flex-col gap-1">
            <p className="type-eyebrow font-semibold uppercase text-primary">
              {t("eyebrow")}
            </p>
            <h1 className="type-heading-lg font-semibold text-balance text-on-surface md:type-heading-xl">
              {data.identity.firstName
                ? t("greeting", { name: data.identity.firstName })
                : t("greeting_fallback")}
            </h1>
          </header>

          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.75fr)]">
            <div className="flex min-w-0 flex-col gap-4">
              <IeltsDailyLoopPanel
                diagnosticReady={diagnosticReady}
                hasGoal={data.hasGoal}
                items={data.today}
                overflowCount={data.todayOverflowCount}
                retention={data.retention}
                totalMinutes={totalMinutes}
              />
              <IeltsEntryTiles
                isEnrolled={data.isEnrolledStudent}
                reviewsDueCount={data.reviewsDueCount}
                softenDueState={data.retention.isFirstRunGrace}
              />
            </div>
            <PredictedBandCard
              view={predictionView}
              planSummary={data.planSummary}
              diagnosticReady={diagnosticReady}
            />
          </div>

          <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
            {hasAttempts ? (
              <section className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container p-4">
                <h2 className="type-heading-md font-semibold text-on-surface">
                  {t("recent_title")}
                </h2>
                <RecentAttempts items={data.recentAttempts} />
              </section>
            ) : null}

            <section className="flex flex-col gap-3 rounded-xl border border-outline-variant bg-surface-container p-4">
              <div className="flex items-center justify-between gap-3">
                <h2 className="type-heading-md font-semibold text-on-surface">
                  {t("featured_title")}
                </h2>
                {hasTests ? (
                  <Link
                    href="/ielts/tests"
                    className="inline-flex min-h-8 items-center gap-1 type-label font-semibold text-primary hover:underline focus-visible:rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {t("view_all")}
                    <ArrowRight className="size-4" />
                  </Link>
                ) : null}
              </div>

              {hasTests ? (
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  {data.featuredTests.slice(0, 2).map((card) => (
                    <TestCard key={card.id} card={card} compact />
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
          </div>
        </PageContainer>
      </ProductPageShell>
    </PageTransition>
  );
}
