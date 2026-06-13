"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { PageTransition } from "@/components/shared/page-motion";
import {
  PageContainer,
  ProductPageShell,
} from "@/components/shared/product-layout";
import { WelcomeBanner } from "@/components/onboarding/welcome-banner";
import { DashboardStatsPanel } from "@/components/dashboard/dashboard-stats-panel";
import { DailyFocusHero } from "@/components/dashboard/daily-focus-hero";
import { TrainingPath } from "@/components/dashboard/training-path";
import { QuestRail } from "@/components/dashboard/quest-rail";
import {
  NextMovesCard,
  RecentActivityCard,
} from "@/components/dashboard/activity-cards";
import type { DashboardHomeData } from "@/lib/api/dashboard";
import { getTimeGreetingKey } from "./plan-copy";

interface DashboardContentProps {
  data: DashboardHomeData;
  displayName: string;
  userId: string;
  showWelcome: boolean;
}

function useDashboardScrollLock() {
  useEffect(() => {
    const root = document.querySelector("[data-dashboard-home]");
    const main = root?.closest("main");

    if (!main) return;

    main.classList.add("dashboard-home-scroll-lock");

    return () => {
      main.classList.remove("dashboard-home-scroll-lock");
    };
  }, []);
}

export function DashboardContent({
  data,
  displayName,
  userId,
  showWelcome,
}: DashboardContentProps) {
  useDashboardScrollLock();

  const t = useTranslations("dashboard.home");
  const checkpoint =
    data.recommendedDrill.skillKey ?? data.skillSnapshot.weakestSkill;

  return (
    <PageTransition data-dashboard-home className="min-h-full bg-background">
      <ProductPageShell className="overflow-x-hidden">
        <PageContainer size="wide" className="flex flex-col py-4 pb-24 lg:py-5 lg:pb-28">
          <div className="flex flex-wrap items-center justify-between gap-3 text-on-surface">
            <p className="type-title min-w-0 font-bold text-on-surface">
              {t(getTimeGreetingKey())}, {displayName}{" "}
              <span aria-hidden="true">👋</span>
            </p>

            <DashboardStatsPanel
              topBar={data.topBar}
              weeklyStats={data.hero.weeklyStats}
              referralCode={data.sidebarCards.referralCode}
              inviteReward={data.sidebarCards.inviteOrbs}
            />
          </div>

          {showWelcome ? (
            <WelcomeBanner displayName={displayName} userId={userId} show />
          ) : null}

          <div className="grid items-start gap-5 pt-5 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-6">
            {/* Main feed */}
            <div className="flex min-w-0 flex-col gap-5">
              <DailyFocusHero drill={data.recommendedDrill} />

              <TrainingPath
                weeklyGoal={data.hero.weeklyGoal}
                metrics={data.skillSnapshot.metrics}
                checkpoint={checkpoint}
              />

              <div className="grid gap-5 xl:grid-cols-2">
                <NextMovesCard items={data.todayPlanItems} />
                <RecentActivityCard items={data.recentActivity} />
              </div>
            </div>

            {/* Right rail (stacks below main feed on mobile) */}
            <QuestRail data={data} />
          </div>
        </PageContainer>
      </ProductPageShell>
    </PageTransition>
  );
}
