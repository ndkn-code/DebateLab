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
import { TodayList } from "./TodayList";
import { IeltsEntryTiles } from "./IeltsEntryTiles";
import { IeltsRetentionPanel } from "./IeltsRetentionPanel";

/**
 * IELTS learner home — the adaptive dashboard (WS-6.2.1). The surface a student
 * lands on after switching to the IELTS subject: a predicted-band card
 * (diagnostic-first until there's real evidence), a prioritized "Today" task
 * list that launches real items, entry tiles into the plan / Learn path / mock
 * library, then recent sittings and a test-library teaser. Debate stays
 * untouched — this only renders when the active subject is `ielts`
 * (gated by `IELTS_ENABLED`).
 */
export function IeltsHome({
  data,
  displayName,
}: {
  data: IeltsHomeData;
  displayName: string;
}) {
  const t = useTranslations("dashboard.ielts");
  const targetBand = data.planSummary?.targetOverallBand ?? DEFAULT_IELTS_TARGET_BAND;
  const predictionView = buildIeltsPredictionCardView(data.prediction, { targetBand });
  const diagnosticReady = Boolean(data.diagnosticTest);
  const totalMinutes = data.today.reduce((sum, item) => sum + item.estimatedMinutes, 0);
  const hasTests = data.featuredTests.length > 0;
  const hasAttempts = data.recentAttempts.length > 0;

  return (
    <PageTransition>
      <ProductPageShell>
        <PageContainer size="wide" className="flex flex-col gap-8 py-6 lg:py-8">
          <header className="flex flex-col gap-1">
            <p className="type-eyebrow font-semibold uppercase text-primary">
              {t("eyebrow")}
            </p>
            <h1 className="type-heading-xl font-bold text-balance text-on-surface">
              {t("greeting", { name: displayName })}
            </h1>
          </header>

          <IeltsRetentionPanel retention={data.retention} />

          <PredictedBandCard
            view={predictionView}
            planSummary={data.planSummary}
            diagnosticReady={diagnosticReady}
          />

          <TodayList
            items={data.today}
            overflowCount={data.todayOverflowCount}
            hasGoal={data.hasGoal}
            diagnosticReady={diagnosticReady}
            totalMinutes={totalMinutes}
          />

          <IeltsEntryTiles
            isEnrolled={data.isEnrolledStudent}
            reviewsDueCount={data.reviewsDueCount}
          />

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
