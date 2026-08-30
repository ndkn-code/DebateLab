"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageTransition } from "@/components/shared/page-motion";
import {
  PageContainer,
  ProductPageShell,
} from "@/components/shared/product-layout";
import { WelcomeBanner } from "@/components/onboarding/welcome-banner";
import { DashboardStatsPanel } from "@/components/dashboard/dashboard-stats-panel";
import { DailyFocusHero } from "@/components/dashboard/daily-focus-hero";
import { DashboardPrimarySummary } from "@/components/dashboard/dashboard-primary-summary";
import { TrainingPath } from "@/components/dashboard/training-path";
import { QuestRail } from "@/components/dashboard/quest-rail";
import {
  NextMovesCard,
  RecentActivityCard,
} from "@/components/dashboard/activity-cards";
import type { DashboardHomeData } from "@/lib/api/dashboard";

const DASHBOARD_TIMEZONE_COOKIE = "thinkfy_timezone";
const DASHBOARD_TIMEZONE_MAX_AGE = 60 * 60 * 24 * 365;

interface DashboardContentProps {
  data: DashboardHomeData;
  displayName: string;
  greetingKey: string;
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

function useDashboardTimezoneCookie() {
  const router = useRouter();

  useEffect(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timezone) return;

    const encodedTimezone = encodeURIComponent(timezone);
    const hasCookie = document.cookie
      .split("; ")
      .some(
        (entry) => entry === `${DASHBOARD_TIMEZONE_COOKIE}=${encodedTimezone}`,
      );

    if (hasCookie) return;

    document.cookie = `${DASHBOARD_TIMEZONE_COOKIE}=${encodedTimezone}; Max-Age=${DASHBOARD_TIMEZONE_MAX_AGE}; Path=/; SameSite=Lax`;
    router.refresh();
  }, [router]);
}

export function DashboardContent({
  data,
  displayName,
  greetingKey,
  userId,
  showWelcome,
}: DashboardContentProps) {
  useDashboardScrollLock();
  useDashboardTimezoneCookie();

  const t = useTranslations("dashboard.home");
  const checkpoint =
    data.recommendedDrill.skillKey ?? data.skillSnapshot.weakestSkill;
  const weeklySessions = data.hero.weeklyStats.reduce(
    (total, entry) => total + entry.sessions_completed,
    0,
  );

  return (
    <PageTransition data-dashboard-home className="min-h-full bg-transparent">
      <ProductPageShell className="overflow-x-hidden bg-transparent">
        <PageContainer
          size="data"
          className="flex flex-col py-5 pb-24 lg:px-6 lg:py-6 lg:pb-28"
        >
          <div
            className="mb-4 h-1 overflow-hidden rounded-full bg-outline-variant/30"
            aria-label={t("daily_focus")}
          >
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{
                width: `${Math.min(100, Math.max(0, data.hero.todayGoal.progressPercent))}%`,
              }}
            />
          </div>
          <div className="flex flex-wrap items-end justify-between gap-4 px-4 text-on-surface">
            <div className="min-w-0">
              <p className="type-heading-lg font-medium text-on-surface">
                {t(greetingKey)},{" "}
                <span className="whitespace-nowrap">
                  {displayName} <span aria-hidden="true">👋</span>
                </span>
              </p>
              <p className="type-label mt-1 text-on-surface-variant">
                {t("daily_focus")}
              </p>
            </div>

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

          <div className="grid items-start gap-4 pt-3 xl:grid-cols-[minmax(0,1fr)_312px]">
            {/* Main feed */}
            <div className="flex min-w-0 flex-col gap-4">
              <DailyFocusHero drill={data.recommendedDrill} />

              <DashboardPrimarySummary
                weeklySessions={weeklySessions}
                weeklyGoal={data.hero.weeklyGoal}
                overallScore={data.skillSnapshot.overallScore}
              />

              <TrainingPath
                metrics={data.skillSnapshot.metrics}
                checkpoint={checkpoint}
              />
            </div>

            {/* Right rail (stacks below main feed on mobile) */}
            <QuestRail data={data} />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
            <div>
              <RecentActivityCard items={data.recentActivity} />
            </div>
            <div>
              <NextMovesCard items={data.todayPlanItems} />
            </div>
          </div>
        </PageContainer>
      </ProductPageShell>
    </PageTransition>
  );
}
