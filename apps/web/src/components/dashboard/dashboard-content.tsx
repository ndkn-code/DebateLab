"use client";

import { useEffect, useMemo, type ReactNode } from "react";
import Image from "next/image";
import { useLocale, useTranslations } from "next-intl";
import {
  ArrowRight,
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
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { Progress } from "@/components/ui/progress";
import { PageTransition } from "@/components/shared/page-motion";
import {
  PageContainer,
  ProductPageShell,
} from "@/components/shared/product-layout";
import { WelcomeBanner } from "@/components/onboarding/welcome-banner";
import { cn } from "@/lib/utils";
import type {
  DashboardHomeData,
  DashboardQuickAction,
  DashboardRecommendedDrill,
  DashboardTodayPlanItem,
} from "@/lib/api/dashboard";
import {
  DASHBOARD_SKILL_ORDER,
  type DashboardGoalSummary,
  type DashboardSkillKey,
  type DashboardSkillMetric,
} from "@thinkfy/shared/dashboard";
import fireAnimation from "../../../public/lottie/fire.json";

const ACTION_ICONS = {
  speaking: Mic,
  debate: Users2,
  course: BookOpen,
  coach: Sparkles,
} as const;

const ACTION_ORDER: DashboardQuickAction["key"][] = [
  "speaking",
  "debate",
  "coach",
  "course",
];

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
      text: "text-[#1F9D55]",
      ring: "border-[#34C759]/30 text-[#1F9D55]",
      soft: "bg-[#EAF8EE]",
    };
  }

  if (metric.value >= 60) {
    return {
      text: "text-[#C77C0C]",
      ring: "border-[#F5B942]/35 text-[#C77C0C]",
      soft: "bg-[#FFF5E4]",
    };
  }

  return {
    text: "text-[#D94B4B]",
    ring: "border-[#EF6A6A]/35 text-[#D94B4B]",
    soft: "bg-[#FFF0F0]",
  };
}

function formatMetricValue(metric: DashboardSkillMetric | null) {
  if (!metric || metric.coverage <= 0) return "— / 100";
  return `${Math.round(metric.value)} / 100`;
}

function getDockTone(key: DashboardQuickAction["key"]) {
  switch (key) {
    case "speaking":
      return "bg-[#EEF4FF] text-primary";
    case "debate":
      return "bg-[#F3EEFF] text-[#7B61FF]";
    case "coach":
      return "bg-[#EAF8F3] text-[#00A085]";
    case "course":
      return "bg-[#FFF5E4] text-[#C77C0C]";
    default:
      return "bg-primary-container text-primary";
  }
}

function UtilityChip({
  icon,
  label,
  value,
  children,
}: {
  icon: ReactNode;
  label: string;
  value?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="inline-flex min-h-12 items-center gap-3 px-3 py-1.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        {value ? (
          <p className="text-[1.05rem] font-semibold leading-none text-[#0B1424]">
            {value}
          </p>
        ) : null}
        {label ? (
          <p className="mt-1 text-xs leading-none text-[#415069]">{label}</p>
        ) : null}
        {children}
      </div>
    </div>
  );
}

function DailyFocusCopy({ drill }: { drill: DashboardRecommendedDrill }) {
  const locale = useLocale();
  const t = useTranslations("dashboard.home");
  const Icon = TASK_ICONS[drill.key];
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
          "mt-4 font-bold text-[#0B1424]",
          isVietnamese
            ? "max-w-[11ch] text-[2.65rem] leading-[1.04] sm:max-w-[12ch] sm:text-[3rem] lg:max-w-[420px] lg:text-[3.25rem] xl:text-[3.35rem]"
            : "max-w-[8.8ch] text-[2.85rem] leading-[0.98] sm:text-[3.45rem] lg:max-w-[13ch] lg:text-[3.8rem] xl:text-[4rem]"
        )}
      >
        {getPlanTitle(drill, t)}
      </h1>

      <p className="mt-4 max-w-[28rem] text-base leading-7 text-[#415069]">
        {getPlanDescription(drill, t)}
      </p>

      <div className="mt-5 flex w-full max-w-[250px] flex-col gap-2">
        <span className="inline-flex min-h-10 items-center gap-3 rounded-full border border-[#DEE8F8] bg-white/85 px-4 text-sm font-semibold text-[#162033] shadow-[0_12px_34px_-28px_rgba(11,20,36,0.45)]">
          <Clock3 className="h-4 w-4 text-primary" />
          {t("recommended_meta_duration", { count: drill.durationMinutes })}
        </span>
        {targetLabel ? (
          <span className="inline-flex min-h-10 items-center gap-3 rounded-full border border-[#DEE8F8] bg-white/85 px-4 text-sm font-semibold text-[#162033] shadow-[0_12px_34px_-28px_rgba(11,20,36,0.45)]">
            <Target className="h-4 w-4 text-warning" />
            {targetLabel}
          </span>
        ) : null}
        {scoreLabel ? (
          <span className="inline-flex min-h-10 items-center gap-3 rounded-full border border-[#DEE8F8] bg-white/85 px-4 text-sm font-semibold text-[#162033] shadow-[0_12px_34px_-28px_rgba(11,20,36,0.45)]">
            <Star className="h-4 w-4 text-warning" />
            {scoreLabel}
          </span>
        ) : null}
      </div>

      <Link href={drill.href} data-testid="dashboard-recommended-cta">
        <Button className="mt-5 min-h-12 rounded-full bg-primary px-7 text-base font-semibold text-on-primary shadow-[0_18px_34px_-18px_rgba(62,120,236,0.9)] hover:bg-[#3E78EC]">
          <Icon className="mr-2 h-5 w-5" />
          {getPlanCtaLabel(drill, t)}
          <ArrowRight className="ml-3 h-5 w-5" />
        </Button>
      </Link>
    </div>
  );
}

function DrillIllustration() {
  return (
    <div
      data-testid="dashboard-recommended-illustration"
      className="relative mx-auto min-h-[250px] w-full max-w-[660px] overflow-visible sm:min-h-[320px] lg:min-h-[360px] xl:min-h-[410px]"
    >
      <div className="absolute left-[8%] right-[5%] top-[3%] h-[78%] rounded-full border border-[#A9C6FB]/38 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.72),rgba(238,244,255,0.34)_58%,rgba(238,244,255,0)_78%)]" />
      <Image
        src="/images/dashboard/recommended-drill-v2.webp"
        alt=""
        fill
        sizes="(max-width: 768px) 92vw, (max-width: 1280px) 38vw, 620px"
        priority
        unoptimized
        className="relative z-[1] scale-[1.08] object-contain object-center drop-shadow-[0_34px_42px_rgba(77,134,247,0.18)] [filter:saturate(1.03)_contrast(1.01)]"
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
              <div className="group grid min-h-[76px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[1.75rem] border border-[#DEE8F8] bg-white/90 px-4 py-2.5 shadow-[0_22px_48px_-34px_rgba(11,20,36,0.35)] transition-all hover:-translate-y-0.5 hover:border-[#A9C6FB] hover:shadow-[0_24px_46px_-30px_rgba(62,120,236,0.35)]">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EEF4FF] text-primary">
                  <Icon className="h-5 w-5" />
                </div>

                <div className="min-w-0">
                  <p className="line-clamp-1 text-xs font-semibold text-primary">
                    {getPlanReason(item, t)}
                  </p>
                  <p className="mt-1 line-clamp-1 text-[0.95rem] font-semibold text-[#0B1424]">
                    {getPlanTitle(item, t)}
                  </p>
                  <p className="mt-1 line-clamp-1 text-xs text-[#415069]">
                    {t("next_move_meta", {
                      duration: item.durationMinutes,
                      context,
                    })}
                  </p>
                </div>

                <ChevronRight className="h-5 w-5 shrink-0 text-[#415069] transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </div>
            </Link>
          );
        })}
      </div>

      <p className="mt-4 inline-flex items-center gap-2 text-sm text-[#415069]">
        <Sparkles className="h-4 w-4 text-primary" />
        {t("next_move_tip")}
      </p>
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
        className="relative flex h-[132px] w-[132px] shrink-0 items-center justify-center rounded-full bg-white shadow-[0_30px_62px_-40px_rgba(11,20,36,0.42)] lg:h-[170px] lg:w-[170px]"
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
            stroke="#EEF3FB"
            strokeWidth="14"
          />
          <circle
            cx="85"
            cy="85"
            r={radius}
            fill="none"
            stroke="#4D86F7"
            strokeDasharray={circumference}
            strokeDashoffset={progressOffset}
            strokeLinecap="round"
            strokeWidth="14"
          />
        </svg>

        <div className="relative z-10 flex h-[92px] w-[92px] flex-col items-center justify-center rounded-full bg-white text-center lg:h-[112px] lg:w-[112px]">
          <Target className="mb-1.5 h-6 w-6 text-primary lg:h-7 lg:w-7" />
          <p className="text-sm font-semibold text-[#0B1424] lg:text-base">
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

      <p className="max-w-[13rem] text-sm leading-6 text-[#415069] lg:hidden lg:text-center lg:text-[1.02rem] lg:leading-8">
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
        <p className="text-sm text-[#718096] lg:text-base">
          {t("training_map_subtitle")}
        </p>
      </div>

      <div className="rounded-[2rem] border border-[#DCE8FA] bg-white/[0.56] px-4 py-4 shadow-[0_28px_90px_-66px_rgba(11,20,36,0.35)] backdrop-blur sm:px-5 lg:hidden">
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
              stroke="#A9C6FB"
              strokeDasharray="6 8"
              strokeLinecap="round"
              strokeWidth="4"
            />
            <path
              d="M930 42 L990 42"
              fill="none"
              stroke="#A9C6FB"
              strokeLinecap="round"
              strokeWidth="4"
            />
            <path
              d="M985 27 L1000 42 L985 57"
              fill="none"
              stroke="#A9C6FB"
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
                  className="relative z-10 flex min-w-0 items-center gap-3 rounded-[1.25rem] border border-[#DEE8F8] bg-white/[0.88] p-3 shadow-[0_14px_34px_-30px_rgba(11,20,36,0.38)]"
                >
                  <div
                    className={cn(
                      "flex h-14 w-14 shrink-0 items-center justify-center rounded-full border bg-white shadow-[0_18px_36px_-30px_rgba(11,20,36,0.42)]",
                      highlighted
                        ? "border-primary bg-primary text-on-primary shadow-[0_0_0_9px_rgba(77,134,247,0.19),0_18px_28px_-18px_rgba(62,120,236,0.85)]"
                        : tone.ring
                    )}
                  >
                    <Icon className="h-6 w-6" />
                  </div>

                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-[#0B1424]">
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
            stroke="#9EC0FB"
            strokeDasharray="5 9"
            strokeLinecap="round"
            strokeWidth="4"
          />
          <path
            d="M934 86 L984 86 M970 71 L990 86 L970 101"
            fill="none"
            stroke="#9EC0FB"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="4"
          />
          <circle cx="238" cy="86" r="5" fill="#4D86F7" />
          <circle cx="542" cy="86" r="5" fill="#4D86F7" />
          <circle cx="836" cy="86" r="5" fill="#4D86F7" />
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
                <span className="absolute -top-[52px] whitespace-nowrap rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-on-primary shadow-[0_14px_24px_-18px_rgba(62,120,236,0.9)] after:absolute after:left-1/2 after:top-full after:h-0 after:w-0 after:-translate-x-1/2 after:border-x-[6px] after:border-t-[7px] after:border-x-transparent after:border-t-primary">
                  {t("next_checkpoint")}
                </span>
              ) : null}

              <div
                className={cn(
                  "flex h-[76px] w-[76px] items-center justify-center rounded-full border bg-white shadow-[0_18px_38px_-30px_rgba(11,20,36,0.5)]",
                  highlighted
                    ? "border-primary bg-primary text-on-primary shadow-[0_0_0_15px_rgba(77,134,247,0.19),0_0_0_29px_rgba(77,134,247,0.09),0_24px_34px_-22px_rgba(62,120,236,0.85)]"
                    : tone.ring
                )}
              >
                <Icon className="h-7 w-7" />
              </div>

              <p className="mt-3 truncate text-[1.05rem] font-semibold text-[#0B1424]">
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

function LaunchDock({ actions }: { actions: DashboardQuickAction[] }) {
  const t = useTranslations("dashboard.home");
  const sortedActions = ACTION_ORDER.map((key) =>
    actions.find((action) => action.key === key)
  ).filter((action): action is DashboardQuickAction => Boolean(action));

  return (
    <nav
      aria-label={t("launch_actions_label")}
      className="fixed bottom-4 left-1/2 z-50 grid w-[calc(100vw-2rem)] max-w-[760px] -translate-x-1/2 grid-cols-4 gap-1 rounded-[2rem] border border-[#DCE8FA] bg-white/[0.92] p-2 shadow-[0_26px_66px_-42px_rgba(11,20,36,0.45)] backdrop-blur-md md:left-[calc(13.75rem+(100vw-13.75rem)/2)] md:gap-2"
    >
      {sortedActions.map((action) => {
        const Icon = ACTION_ICONS[action.key];
        const content = (
            <div className="group flex min-h-[54px] flex-col items-center justify-center gap-1 rounded-[1.45rem] px-1 text-[0.72rem] font-semibold text-[#0B1424] transition-colors hover:bg-[#F1F6FD] md:min-h-[50px] md:flex-row md:gap-3 md:px-3 md:text-sm">
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full md:h-10 md:w-10",
                  getDockTone(action.key)
                )}
              >
              <Icon className="h-4 w-4 md:h-5 md:w-5" />
            </span>
            <span className="truncate">{t(`launch_action_${action.key}`)}</span>
          </div>
        );

        if (action.href && action.status === "live") {
          return (
            <Link key={action.key} href={action.href}>
              {content}
            </Link>
          );
        }

        return <div key={action.key}>{content}</div>;
      })}
    </nav>
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

  return (
    <div className="grid gap-4 lg:hidden">
      <div className="rounded-[1.5rem] border border-[#DEE8F8] bg-white/85 p-5 shadow-[0_24px_70px_-56px_rgba(22,39,91,0.42)]">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#0B1424]">
              {t("invite_friend_title")}
            </p>
            <p className="text-sm text-primary">
              {t("invite_friend_reward", { count: inviteReward })}
            </p>
          </div>
        </div>

        <div className="mt-4 rounded-xl border border-dashed border-[#DEE8F8] bg-[#F7FAFE] px-3 py-2 text-sm text-[#415069]">
          {referralCode ?? t("referral_code_pending")}
        </div>
      </div>
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
  const topBar = data.topBar;
  const currentXpInLevel = topBar.xpCurrent % topBar.xpGoal;
  const checkpoint =
    data.recommendedDrill.skillKey ?? data.skillSnapshot.weakestSkill;

  return (
    <>
      <PageTransition data-dashboard-home className="min-h-full bg-background">
        <ProductPageShell className="overflow-x-hidden">
          <PageContainer size="wide" className="flex flex-col py-4 pb-32 lg:py-5 lg:pb-36">
          <div className="flex flex-wrap items-center justify-between gap-3 text-on-surface">
            <p className="min-w-0 text-[1.05rem] font-medium text-[#0B1424] sm:text-[1.15rem]">
              {t(getTimeGreetingKey())}, {displayName}{" "}
              <span aria-hidden="true">👋</span>
            </p>

            <div className="flex flex-wrap items-center justify-end gap-1">
              <UtilityChip
                icon={
                  <LottieAnimation
                    animationData={fireAnimation}
                    className="h-7 w-7"
                    loop
                  />
                }
                label={t("topbar_streak")}
                value={topBar.currentStreak}
              />
              <div className="hidden h-10 w-px bg-[#DEE8F8] sm:block" />
              <UtilityChip
                icon={<Sparkles className="h-5 w-5 text-[#F5B942]" />}
                label={t("topbar_orbs")}
                value={topBar.orbBalance.toLocaleString()}
              />
              <div className="hidden h-10 w-px bg-[#DEE8F8] sm:block" />
              <UtilityChip
                icon={<Star className="h-5 w-5 text-primary" />}
                label=""
                value={t("level", { level: topBar.level })}
              >
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-xs text-[#415069]">
                    {currentXpInLevel} / {topBar.xpGoal} XP
                  </span>
                  <Progress
                    value={(currentXpInLevel / topBar.xpGoal) * 100}
                    className="h-1.5 w-20 bg-[#E8EEF8]"
                  />
                </div>
              </UtilityChip>
            </div>
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
      <LaunchDock actions={data.quickActions} />
    </>
  );
}
