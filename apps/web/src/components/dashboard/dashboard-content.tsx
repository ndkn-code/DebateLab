"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import {
  BookOpen,
  ChartColumnBig,
  ChevronRight,
  Clock3,
  GitBranch,
  MessageSquareText,
  Mic,
  Scale,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Users2,
} from "@/components/ui/icons";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { PageTransition } from "@/components/shared/page-motion";
import {
  PageContainer,
  ProductPageShell,
} from "@/components/shared/product-layout";
import { WelcomeBanner } from "@/components/onboarding/welcome-banner";
import { ReferralCreditsDialog } from "@/components/shared/referral-credits-dialog";
import { DashboardStatsPanel } from "@/components/dashboard/dashboard-stats-panel";
import { cn } from "@/lib/utils";
import type {
  DashboardHomeData,
  DashboardRecommendedDrill,
  DashboardTodayPlanItem,
} from "@/lib/api/dashboard";
import {
  DASHBOARD_SKILL_ORDER,
  type DashboardGoalSummary,
  type DashboardSkillKey,
  type DashboardSkillMetric,
} from "@thinkfy/shared/dashboard";

const TASK_ICONS = {
  "continue-course": BookOpen,
  "weakest-skill": Target,
  "underused-track": Users2,
  "review-feedback": MessageSquareText,
  "start-speaking": Mic,
  "start-debate": Scale,
  "coach-check": Sparkles,
} as const;

const SCORE_ICONS = {
  clarity: Target,
  logic: Scale,
  rebuttal: ShieldCheck,
  evidence: ChartColumnBig,
  delivery: Mic,
} as const;

const TRAINING_NODE_POSITIONS: Record<DashboardSkillKey, string> = {
  clarity: "31%",
  logic: "46%",
  rebuttal: "61%",
  evidence: "76%",
  delivery: "91%",
};

function getTimeGreetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "greeting_morning";
  if (hour < 17) return "greeting_afternoon";
  return "greeting_evening";
}

function getPlanTrackLabel(
  track: DashboardRecommendedDrill["track"],
  t: ReturnType<typeof useTranslations>
) {
  if (track === "speaking") return t("track_speaking");
  return t("track_debate");
}

function getPlanTitle(
  item: DashboardRecommendedDrill,
  t: ReturnType<typeof useTranslations>
) {
  switch (item.key) {
    case "continue-course":
      return t("plan_title_continue_course");
    case "weakest-skill":
      return item.skillKey
        ? t("plan_title_weakest_skill", {
            skill: t(`skill_labels.${item.skillKey}`),
          })
        : t("plan_title_weakest_skill_generic");
    case "underused-track":
      return item.track === "speaking"
        ? t("plan_title_underused_speaking")
        : t("plan_title_underused_debate");
    case "review-feedback":
      return t("plan_title_review_feedback");
    case "start-speaking":
      return t("plan_title_start_speaking");
    case "start-debate":
      return t("plan_title_start_debate");
    case "coach-check":
      return t("plan_title_coach");
    default:
      return t("next_move");
  }
}

function getPlanReason(
  item: DashboardRecommendedDrill,
  t: ReturnType<typeof useTranslations>
) {
  switch (item.key) {
    case "continue-course":
      return t("plan_reason_course");
    case "review-feedback":
      return t("plan_reason_feedback");
    case "weakest-skill":
      return t("plan_reason_skill");
    case "underused-track":
      return t("plan_reason_rebalance");
    case "start-speaking":
    case "start-debate":
      return t("plan_reason_start");
    case "coach-check":
      return t("plan_reason_coach");
    default:
      return t("plan_reason_start");
  }
}

function getPlanDescription(
  item: DashboardRecommendedDrill,
  t: ReturnType<typeof useTranslations>
) {
  switch (item.key) {
    case "continue-course":
      return item.context ?? t("plan_context_course_fallback");
    case "weakest-skill":
      return item.skillKey
        ? t("recommended_desc_weakest", {
            skill: t(`skill_labels.${item.skillKey}`),
          })
        : t("recommended_desc_weakest_generic");
    case "review-feedback":
      return item.context ?? t("plan_context_feedback_fallback");
    case "underused-track":
      return item.track === "speaking"
        ? t("recommended_desc_underused_speaking")
        : t("recommended_desc_underused_debate");
    case "start-speaking":
      return t("recommended_desc_start_speaking");
    case "start-debate":
      return t("recommended_desc_start_debate");
    case "coach-check":
      return t("recommended_desc_coach");
    default:
      return "";
  }
}

function getPlanCtaLabel(
  item: DashboardRecommendedDrill,
  t: ReturnType<typeof useTranslations>
) {
  switch (item.ctaKey) {
    case "continue":
      return t("plan_cta_continue");
    case "review":
      return t("plan_cta_review");
    case "ask-coach":
      return t("plan_cta_ask_coach");
    case "start":
    default:
      return t("plan_cta_start");
  }
}

function getMetricTone(metric: DashboardSkillMetric | null) {
  if (!metric || metric.coverage <= 0) {
    return {
      text: "text-on-surface-variant",
      ring: "border-outline-variant/25 text-on-surface-variant",
      soft: "bg-surface-container-low",
    };
  }

  if (metric.value >= 70) {
    return {
      text: "text-on-surface-variant",
      ring: "border-outline-variant/30 text-on-surface-variant",
      soft: "bg-success-container",
    };
  }

  if (metric.value >= 60) {
    return {
      text: "text-warning",
      ring: "border-warning/35 text-warning",
      soft: "bg-warning-container",
    };
  }

  return {
    text: "text-error",
    ring: "border-error/35 text-error",
    soft: "bg-error-container",
  };
}

function formatMetricValue(metric: DashboardSkillMetric | null) {
  if (!metric || metric.coverage <= 0) return "— / 100";
  return `${Math.round(metric.value)} / 100`;
}

function DailyFocusCopy({ drill }: { drill: DashboardRecommendedDrill }) {
  const locale = useLocale();
  const t = useTranslations("dashboard.home");
  const isVietnamese = locale === "vi";
  const targetLabel = drill.skillKey
    ? t("recommended_meta_target_skill", {
        skill: t(`skill_labels.${drill.skillKey}`),
      })
    : drill.track
      ? t("recommended_meta_track", {
          track: getPlanTrackLabel(drill.track, t),
        })
      : null;
  const scoreLabel =
    drill.scoreOutOf100 != null
      ? t("recommended_meta_score", { score: drill.scoreOutOf100 })
      : drill.progressLabel
        ? t("recommended_meta_progress", { progress: drill.progressLabel })
        : null;

  return (
    <div className="relative z-10 flex min-w-0 flex-col items-start lg:max-w-[390px]">
      <span className="inline-flex items-center gap-2 text-[0.92rem] font-semibold text-primary">
        <Target className="h-4 w-4" />
        {t("daily_focus")}
      </span>

      <h1
        data-testid="dashboard-daily-focus-title"
        className={cn(
          "mt-4 font-bold text-on-surface dark:text-on-surface",
          isVietnamese
            ? "max-w-[11ch] text-[2.65rem] leading-[1.04] sm:max-w-[12ch] sm:text-[3rem] lg:max-w-[420px] lg:text-[3.25rem] xl:text-[3.35rem]"
            : "max-w-[8.8ch] text-[2.85rem] leading-[0.98] sm:text-[3.45rem] lg:max-w-[13ch] lg:text-[3.8rem] xl:text-[4rem]"
        )}
      >
        {getPlanTitle(drill, t)}
      </h1>

      <p className="mt-4 max-w-[28rem] text-base leading-7 text-on-surface-variant dark:text-on-surface-variant">
        {getPlanDescription(drill, t)}
      </p>

      <div className="mt-5 flex w-full max-w-[250px] flex-col gap-2">
        <span className="inline-flex min-h-10 items-center gap-3 rounded-full border border-outline-variant bg-white/85 px-4 text-sm font-semibold text-on-surface shadow-token-card dark:border-outline-variant/70 dark:bg-surface/85 dark:text-on-surface">
          <Clock3 className="h-4 w-4 text-primary" />
          {t("recommended_meta_duration", { count: drill.durationMinutes })}
        </span>
        {targetLabel ? (
          <span className="inline-flex min-h-10 items-center gap-3 rounded-full border border-outline-variant bg-white/85 px-4 text-sm font-semibold text-on-surface shadow-token-card dark:border-outline-variant/70 dark:bg-surface/85 dark:text-on-surface">
            <Target className="h-4 w-4 text-warning" />
            {targetLabel}
          </span>
        ) : null}
        {scoreLabel ? (
          <span className="inline-flex min-h-10 items-center gap-3 rounded-full border border-outline-variant bg-white/85 px-4 text-sm font-semibold text-on-surface shadow-token-card dark:border-outline-variant/70 dark:bg-surface/85 dark:text-on-surface">
            <Star className="h-4 w-4 text-warning" />
            {scoreLabel}
          </span>
        ) : null}
      </div>

      <Link href={drill.href} data-testid="dashboard-recommended-cta">
        <Button className="mt-5 min-h-14 min-w-[236px] rounded-[1.7rem] bg-primary px-10 text-lg font-extrabold text-on-primary">
          {getPlanCtaLabel(drill, t)}
        </Button>
      </Link>
    </div>
  );
}

function DrillIllustration() {
  return (
    <div
      data-testid="dashboard-recommended-illustration"
      className="relative mx-auto min-h-[250px] w-full max-w-[660px] overflow-hidden sm:min-h-[320px] lg:min-h-[360px] xl:min-h-[410px]"
    >
      <div className="absolute left-[8%] right-[5%] top-[3%] h-[78%] rounded-full border border-primary-fixed/38 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.72),rgba(229,248,252,0.34)_58%,rgba(229,248,252,0)_78%)] dark:border-primary/25 dark:bg-[radial-gradient(ellipse_at_center,rgba(0,184,217,0.16),rgba(6,21,26,0.28)_58%,rgba(6,21,26,0)_78%)]" />
      <Image
        src="/images/dashboard/recommended-drill-v2.webp"
        alt=""
        fill
        sizes="(max-width: 768px) 92vw, (max-width: 1280px) 38vw, 620px"
        priority
        unoptimized
        className="relative z-[1] scale-[1.08] object-contain object-center drop-shadow-token-primary [filter:saturate(1.03)_contrast(1.01)]"
      />
    </div>
  );
}

function NextMoveRail({ items }: { items: DashboardTodayPlanItem[] }) {
  const t = useTranslations("dashboard.home");

  return (
    <section
      data-testid="dashboard-next-move"
      aria-labelledby="dashboard-next-move-heading"
      className="relative z-10 flex min-w-0 flex-col lg:max-w-[390px]"
    >
      <h2
        id="dashboard-next-move-heading"
        className="inline-flex items-center gap-2 text-[0.95rem] font-semibold text-primary"
      >
        <Sparkles className="h-4 w-4" />
        {t("next_move")}
      </h2>

      <div className="mt-4 flex flex-col gap-3">
        {items.map((item) => {
          const Icon = TASK_ICONS[item.key];
          const context =
            item.context ??
            (item.track
              ? getPlanTrackLabel(item.track, t)
              : t("recommended_context_fallback"));

          return (
            <Link key={item.id} href={item.href} data-testid="dashboard-next-move-row">
              <div className="group grid min-h-[76px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[1.75rem] border border-outline-variant bg-white/90 px-4 py-2.5 shadow-token-card transition-all hover:-translate-y-0.5 hover:border-primary-fixed hover:shadow-token-card dark:border-outline-variant/70 dark:bg-surface/90 dark:hover:border-primary/40">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-container text-primary dark:bg-primary-container">
                  <Icon className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <p className="line-clamp-1 text-xs font-semibold text-primary">
                    {getPlanReason(item, t)}
                  </p>
                  <p className="mt-1 line-clamp-1 text-[0.95rem] font-semibold text-on-surface dark:text-on-surface">
                    {getPlanTitle(item, t)}
                  </p>
                  <p className="mt-1 line-clamp-1 text-xs text-on-surface-variant dark:text-on-surface-variant">
                    {t("next_move_meta", {
                      duration: item.durationMinutes,
                      context,
                    })}
                  </p>
                </div>

                <ChevronRight className="h-5 w-5 shrink-0 text-on-surface-variant transition-transform group-hover:translate-x-0.5 group-hover:text-primary dark:text-on-surface-variant" />
              </div>
            </Link>
          );
        })}
      </div>

    </section>
  );
}

function WeeklyGoalRing({ goal }: { goal: DashboardGoalSummary }) {
  const t = useTranslations("dashboard.home");
  const radius = 69;
  const circumference = 2 * Math.PI * radius;
  const progressOffset =
    circumference - (Math.min(goal.progressPercent, 100) / 100) * circumference;

  return (
    <div className="flex items-center gap-5 lg:flex-col lg:items-center lg:gap-5">
      <div
        className="relative flex h-[132px] w-[132px] shrink-0 items-center justify-center rounded-full bg-white shadow-token-card dark:bg-surface lg:h-[170px] lg:w-[170px]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={goal.goalMinutes}
        aria-valuenow={goal.practicedMinutes}
        aria-label={t("weekly_goal")}
      >
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full -rotate-90"
          viewBox="0 0 170 170"
        >
          <circle
            cx="85"
            cy="85"
            r={radius}
            fill="none"
            stroke="#E5F8FC"
            strokeWidth="14"
          />
          <circle
            cx="85"
            cy="85"
            r={radius}
            fill="none"
            stroke="#00B8D9"
            strokeDasharray={circumference}
            strokeDashoffset={progressOffset}
            strokeLinecap="round"
            strokeWidth="14"
          />
        </svg>

        <div className="relative z-10 flex h-[92px] w-[92px] flex-col items-center justify-center rounded-full bg-white text-center dark:bg-surface-container-lowest lg:h-[112px] lg:w-[112px]">
          <Target className="mb-1.5 h-6 w-6 text-primary lg:h-7 lg:w-7" />
          <p className="text-sm font-semibold text-on-surface dark:text-on-surface lg:text-base">
            {t("weekly_goal")}
          </p>
          <p className="mt-1 whitespace-nowrap text-xs font-semibold text-primary lg:text-sm">
            {t("weekly_goal_progress", {
              practiced: goal.practicedMinutes,
              goal: goal.goalMinutes,
            })}
          </p>
        </div>
      </div>

      <p className="max-w-[13rem] text-sm leading-6 text-on-surface-variant dark:text-on-surface-variant lg:hidden lg:text-center lg:text-[1.02rem] lg:leading-8">
        {goal.metGoal
          ? t("weekly_goal_met")
          : t("minutes_remaining", { count: goal.remainingMinutes })}
      </p>
    </div>
  );
}

function TrainingMap({
  weeklyGoal,
  metrics,
  checkpoint,
}: {
  weeklyGoal: DashboardGoalSummary;
  metrics: DashboardSkillMetric[];
  checkpoint: DashboardSkillKey | null;
}) {
  const t = useTranslations("dashboard.home");
  const metricsByKey = useMemo(
    () => new Map(metrics.map((metric) => [metric.key, metric])),
    [metrics]
  );

  return (
    <section
      data-testid="dashboard-training-map"
      aria-labelledby="dashboard-training-map-heading"
      className="relative mt-8 lg:mt-6"
    >
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <h2
          id="dashboard-training-map-heading"
          className="inline-flex items-center gap-2 text-[1.05rem] font-semibold text-primary lg:text-[1.1rem]"
        >
          <GitBranch className="h-4 w-4" />
          {t("training_map")}
        </h2>
      </div>

      <div className="rounded-[2rem] border border-outline-variant bg-white/[0.56] px-4 py-4 shadow-token-panel backdrop-blur dark:border-outline-variant/70 dark:bg-surface/55 sm:px-5 lg:hidden">
        <WeeklyGoalRing goal={weeklyGoal} />

        <div className="relative mt-7">
          <svg
            aria-hidden="true"
            className="pointer-events-none absolute left-[6%] right-[2%] top-[36px] hidden h-[64px] w-[92%] overflow-visible lg:block"
            viewBox="0 0 1000 80"
            preserveAspectRatio="none"
          >
            <path
              d="M0 42 C120 18 205 18 300 41 S500 61 610 40 S790 21 930 42"
              fill="none"
              stroke="#8BE8F7"
              strokeDasharray="6 8"
              strokeLinecap="round"
              strokeWidth="4"
            />
            <path
              d="M930 42 L990 42"
              fill="none"
              stroke="#8BE8F7"
              strokeLinecap="round"
              strokeWidth="4"
            />
            <path
              d="M985 27 L1000 42 L985 57"
              fill="none"
              stroke="#8BE8F7"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="4"
            />
          </svg>

          <div className="grid gap-3 sm:grid-cols-2">
            {DASHBOARD_SKILL_ORDER.map((key) => {
              const metric = metricsByKey.get(key) ?? null;
              const Icon = SCORE_ICONS[key];
              const tone = getMetricTone(metric);
              const highlighted = checkpoint === key;

              return (
                <div
                  key={key}
                  data-testid={`dashboard-mobile-training-map-${key}`}
                  className="relative z-10 flex min-w-0 items-center gap-3 rounded-[1.25rem] border border-outline-variant bg-white/[0.88] p-3 shadow-token-card dark:border-outline-variant/70 dark:bg-surface/88"
                >
                  <div
                    className={cn(
                      "flex h-14 w-14 shrink-0 items-center justify-center rounded-full border bg-white shadow-token-card dark:bg-surface-container-lowest",
                      highlighted
                        ? "border-primary bg-primary text-on-primary shadow-token-primary"
                        : tone.ring
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-on-surface dark:text-on-surface">
                      {t(`skill_labels.${key}`)}
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-sm font-semibold",
                        highlighted ? "text-primary" : tone.text
                      )}
                    >
                      {formatMetricValue(metric)}
                    </p>
                    {highlighted ? (
                      <p className="mt-1 text-xs font-semibold text-primary lg:hidden">
                        {t("next_checkpoint")}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="relative hidden min-h-[228px] lg:block">
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[150px] w-full overflow-visible"
          viewBox="0 0 1000 150"
          preserveAspectRatio="none"
        >
          <path
            d="M138 86 C220 62 258 62 310 86 S395 111 460 86 S545 62 610 86 S690 108 760 86 S858 70 934 86"
            fill="none"
            stroke="#8BE8F7"
            strokeDasharray="5 9"
            strokeLinecap="round"
            strokeWidth="4"
          />
          <path
            d="M934 86 L984 86 M970 71 L990 86 L970 101"
            fill="none"
            stroke="#8BE8F7"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
          />
          <circle cx="238" cy="86" r="5" fill="#00B8D9" />
          <circle cx="542" cy="86" r="5" fill="#00B8D9" />
          <circle cx="836" cy="86" r="5" fill="#00B8D9" />
        </svg>

        <div className="absolute left-0 top-0">
          <WeeklyGoalRing goal={weeklyGoal} />
        </div>

        {DASHBOARD_SKILL_ORDER.map((key) => {
          const metric = metricsByKey.get(key) ?? null;
          const Icon = SCORE_ICONS[key];
          const tone = getMetricTone(metric);
          const highlighted = checkpoint === key;

          return (
            <div
              key={key}
              data-testid={`dashboard-training-map-${key}`}
              className="absolute top-[48px] z-10 flex w-[112px] -translate-x-1/2 flex-col items-center text-center"
              style={{ left: TRAINING_NODE_POSITIONS[key] }}
            >
              {highlighted ? (
                <span className="absolute -top-[52px] whitespace-nowrap rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-on-primary shadow-token-card after:absolute after:left-1/2 after:top-full after:h-0 after:w-0 after:-translate-x-1/2 after:border-x-[6px] after:border-t-[7px] after:border-x-transparent after:border-t-primary">
                  {t("next_checkpoint")}
                </span>
              ) : null}

              <div
                className={cn(
                  "flex h-[76px] w-[76px] items-center justify-center rounded-full border bg-white shadow-token-card dark:bg-surface-container-lowest",
                  highlighted
                    ? "border-primary bg-primary text-on-primary shadow-token-primary"
                    : tone.ring
                )}
              >
                <Icon className="h-7 w-7" />
              </div>

              <p className="mt-3 truncate text-[1.05rem] font-semibold text-on-surface dark:text-on-surface">
                {t(`skill_labels.${key}`)}
              </p>
              <p
                className={cn(
                  "mt-1 text-base font-semibold",
                  highlighted ? "text-primary" : tone.text
                )}
              >
                {formatMetricValue(metric)}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function MobileSupportCards({
  referralCode,
  inviteReward,
}: {
  referralCode: string | null;
  inviteReward: number;
}) {
  const t = useTranslations("dashboard.home");
  const [referralOpen, setReferralOpen] = useState(false);

  return (
    <div className="grid gap-4 lg:hidden">
      <button
        type="button"
        disabled={!referralCode}
        data-testid="dashboard-mobile-referral-card"
        onClick={() => {
          if (referralCode) setReferralOpen(true);
        }}
        className="rounded-[1.5rem] border border-outline-variant bg-white/85 p-5 text-left shadow-token-panel transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-token-card focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-outline-variant/70 dark:bg-surface/85"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-on-surface dark:text-on-surface">
              {t("invite_friend_title")}
            </p>
            <p className="text-sm text-primary">
              {t("invite_friend_reward", { count: inviteReward })}
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-primary" />
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-outline-variant bg-background px-3 py-2 text-sm text-on-surface-variant dark:border-outline-variant/70 dark:bg-surface-container-lowest dark:text-on-surface-variant">
          {referralCode ?? t("referral_code_pending")}
        </div>
      </button>
      <ReferralCreditsDialog
        open={referralOpen}
        onOpenChange={setReferralOpen}
        referralCode={referralCode}
        inviteReward={inviteReward}
      />
    </div>
  );
}

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
    <>
      <PageTransition data-dashboard-home className="min-h-full bg-background">
        <ProductPageShell className="overflow-x-hidden">
          <PageContainer size="wide" className="flex flex-col py-4 pb-32 lg:py-5 lg:pb-36">
          <div className="flex flex-wrap items-center justify-between gap-3 text-on-surface">
            <p className="min-w-0 text-[1.05rem] font-medium text-on-surface dark:text-on-surface sm:text-[1.15rem]">
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

          <section
            data-testid="dashboard-open-canvas"
            className="relative grid gap-8 pt-8 lg:min-h-[400px] lg:grid-cols-[minmax(300px,0.82fr)_minmax(430px,1.2fr)_minmax(280px,0.82fr)] lg:items-center lg:gap-7 xl:min-h-[420px]"
          >
            <DailyFocusCopy drill={data.recommendedDrill} />
            <DrillIllustration />
            <NextMoveRail items={data.todayPlanItems} />
          </section>

          <TrainingMap
            weeklyGoal={data.hero.weeklyGoal}
            metrics={data.skillSnapshot.metrics}
            checkpoint={checkpoint}
          />

          <div className="mt-6">
            <MobileSupportCards
              referralCode={data.sidebarCards.referralCode}
              inviteReward={data.sidebarCards.inviteOrbs}
            />
          </div>
          </PageContainer>
        </ProductPageShell>
      </PageTransition>
    </>
  );
}
