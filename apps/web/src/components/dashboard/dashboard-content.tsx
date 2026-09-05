"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { PageTransition } from "@/components/shared/page-motion";
import {
  PageContainer,
  ProductPageShell,
} from "@/components/shared/product-layout";
import { Button } from "@/components/ui/button";
import { getHomeDataState, retainHomeData } from "./home-data-state";
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

    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${DASHBOARD_TIMEZONE_COOKIE}=${encodedTimezone}; Max-Age=${DASHBOARD_TIMEZONE_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
    router.refresh();
  }, [router]);
}

export function DashboardContent({
  data: incomingData,
  displayName,
  greetingKey,
  userId,
  showWelcome,
}: DashboardContentProps) {
  useDashboardScrollLock();
  useDashboardTimezoneCookie();

  const t = useTranslations("dashboard.home");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [snapshot, setSnapshot] = useState({
    input: incomingData,
    userId,
    data: incomingData,
    retained: false,
  });
  let current = snapshot;
  if (snapshot.input !== incomingData || snapshot.userId !== userId) {
    current = {
      input: incomingData,
      userId,
      ...(snapshot.userId === userId
        ? retainHomeData(snapshot.data, incomingData)
        : { data: incomingData, retained: false }),
    };
    setSnapshot(current);
  }
  const data = current.data;
  const state = getHomeDataState(data);
  const retryable = getHomeDataState(incomingData).retryable;
  const checkpoint =
    data.recommendedDrill.skillKey ?? data.skillSnapshot.weakestSkill;
  const weeklySessions = data.hero.weeklyStats.reduce(
    (total, entry) => total + entry.sessions_completed,
    0,
  );

  return (
    <PageTransition
      data-dashboard-home
      data-progress-freshness={current.retained ? "last-known" : "current"}
      aria-describedby={current.retained ? "dashboard-data-status" : undefined}
      className="min-h-full bg-transparent"
    >
      <ProductPageShell className="overflow-x-hidden bg-transparent">
        <PageContainer
          size="data"
          className="flex flex-col py-5 pb-24 lg:px-6 lg:py-6 lg:pb-28"
        >
          {state.goals ? (
            <div
              className="mb-4 h-1 overflow-hidden rounded-full bg-outline-variant"
              aria-label={t("daily_focus")}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.min(
                100,
                Math.max(0, data.hero.todayGoal.progressPercent),
              )}
            >
              <div
                className="h-full rounded-full bg-primary transition-[width] duration-300"
                style={{
                  width: `${Math.min(100, Math.max(0, data.hero.todayGoal.progressPercent))}%`,
                }}
              />
            </div>
          ) : null}
          <div className="flex flex-wrap items-end justify-between gap-4 px-4 text-on-surface">
            <div className="min-w-0">
              <p className="type-heading-lg font-medium text-on-surface">
                {t(greetingKey)},{" "}
                <span className="break-words">
                  {displayName} <span aria-hidden="true">👋</span>
                </span>
              </p>
              <p className="type-label mt-1 text-on-surface-variant">
                {t("daily_focus")}
              </p>
            </div>

            <DashboardStatsPanel
              profileAvailable={state.profile}
              streakAvailable={state.streak}
              activityAvailable={state.activity && !state.activityPartial}
              topBar={data.topBar}
              weeklyStats={data.hero.weeklyStats}
              referralCode={data.sidebarCards.referralCode}
              inviteReward={data.sidebarCards.inviteOrbs}
            />
          </div>

          {showWelcome ? (
            <WelcomeBanner
              key={userId}
              displayName={displayName}
              userId={userId}
              show
            />
          ) : null}

          {retryable ? (
            <section
              aria-label={t("data_unavailable_title")}
              className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-control border border-outline-variant bg-surface-container-low p-4"
              data-testid="dashboard-data-notice"
            >
              <div
                id="dashboard-data-status"
                className="min-w-0 flex-1"
                role="status"
              >
                <p className="type-label text-on-surface">
                  {t("data_unavailable_title")}
                </p>
                <p className="type-body-sm mt-1 text-on-surface-variant">
                  {t(
                    current.retained
                      ? "progress_saved"
                      : "data_unavailable_body",
                  )}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => startTransition(() => router.refresh())}
                disabled={isPending}
                aria-busy={isPending}
                data-testid="dashboard-retry"
              >
                {t(isPending ? "retrying_progress" : "retry_progress")}
              </Button>
            </section>
          ) : null}

          <div className="grid items-start gap-4 pt-3 xl:grid-cols-[minmax(0,1fr)_312px]">
            {/* Main feed */}
            <div className="flex min-w-0 flex-col gap-4">
              <DailyFocusHero drill={data.recommendedDrill} />

              <DashboardPrimarySummary
                activityAvailable={state.activity}
                activityPartial={state.activityPartial}
                goalsAvailable={state.goals}
                skillsAvailable={state.skills}
                weeklySessions={weeklySessions}
                weeklyGoal={data.hero.weeklyGoal}
                overallScore={data.skillSnapshot.overallScore}
              />

              <TrainingPath
                available={state.skills}
                metrics={data.skillSnapshot.metrics}
                checkpoint={checkpoint}
              />
            </div>

            {/* Right rail (stacks below main feed on mobile) */}
            <QuestRail data={data} />
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
            <div>
              <RecentActivityCard
                items={data.recentActivity}
                available={state.history}
              />
            </div>
            <div>
              <NextMovesCard
                items={data.todayPlanItems.filter(
                  (item) => item.href !== data.recommendedDrill.href,
                )}
              />
            </div>
          </div>
        </PageContainer>
      </ProductPageShell>
    </PageTransition>
  );
}
