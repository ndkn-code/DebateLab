"use client";

import { useState, type ReactNode } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Clock3,
  Copy,
  HelpCircle,
  MessageSquareText,
  Mic,
  Scale,
  Settings,
  Sparkles,
  Star,
  Target,
  Trophy,
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
  DashboardProgressMetric,
  DashboardQuickAction,
  DashboardRecentItem,
  DashboardRecommendedDrill,
  DashboardTodayPlanItem,
} from "@/lib/api/dashboard";
import { SkillSnapshotCard } from "./skill-snapshot-card";
import fireAnimation from "../../../public/lottie/fire.json";

const ACTION_ICONS = {
  speaking: Mic,
  debate: Users2,
  course: BookOpen,
  coach: Sparkles,
} as const;
const TASK_ICONS = {
  "continue-course": BookOpen,
  "weakest-skill": Target,
  "underused-track": Users2,
  "review-feedback": MessageSquareText,
  "start-speaking": Mic,
  "start-debate": Scale,
  "coach-check": Sparkles,
} as const;
const PROGRESS_ICONS = {
  "total-sessions": Trophy,
  "strong-rate": Target,
  "average-score": MessageSquareText,
  "practice-time": Clock3,
} as const;
const PANEL_ROW_CLASS =
  "grid h-[64px] items-center gap-3 rounded-[1rem] bg-surface-container px-3.5 py-2";

function getTimeGreetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "greeting_morning";
  if (hour < 17) return "greeting_afternoon";
  return "greeting_evening";
}

function formatRelativeTime(
  iso: string,
  tProfile: ReturnType<typeof useTranslations>
) {
  const now = Date.now();
  const timestamp = new Date(iso).getTime();
  const diffSeconds = Math.max(1, Math.round((now - timestamp) / 1000));

  if (diffSeconds < 3600) {
    return tProfile("time_minutes_ago", { count: Math.round(diffSeconds / 60) });
  }

  if (diffSeconds < 86400) {
    return tProfile("time_hours_ago", { count: Math.round(diffSeconds / 3600) });
  }

  return tProfile("time_days_ago", { count: Math.round(diffSeconds / 86400) });
}

function deltaClass(delta: number | null) {
  if (delta == null) return "text-on-surface-variant";
  if (delta > 0) return "text-emerald-600";
  if (delta < 0) return "text-rose-500";
  return "text-on-surface-variant";
}

function deltaPrefix(delta: number | null) {
  if (delta == null || delta === 0) return "";
  return delta > 0 ? "+" : "";
}

function getActionTone(key: DashboardQuickAction["key"]) {
  switch (key) {
    case "speaking":
      return "from-[#A9C6FB] to-[#4D86F7] text-white";
    case "debate":
      return "from-[#D9E8FF] to-[#A9C6FB] text-[#3E78EC]";
    case "course":
      return "from-[#E8F7EC] to-[#CFF2DA] text-[#249B55]";
    case "coach":
      return "from-[#EEF4FF] to-[#DCEAFF] text-[#4D86F7]";
    default:
      return "from-primary to-primary";
  }
}

function getRecentKindLabel(
  item: DashboardRecentItem,
  t: ReturnType<typeof useTranslations>
) {
  switch (item.kind) {
    case "speaking":
      return t("track_speaking");
    case "debate":
      return t("track_debate");
    case "course":
    case "lesson":
    case "level":
    case "streak":
      return item.subtitle;
    default:
      return item.subtitle;
  }
}

function getRecentKindTone(kind: DashboardRecentItem["kind"]) {
  switch (kind) {
    case "speaking":
      return "bg-[#eef4ff] text-[#3d70df]";
    case "debate":
      return "bg-[#f4f0ff] text-[#7352dd]";
    case "course":
    case "lesson":
      return "bg-[#ebf8ef] text-[#3e9a5c]";
    case "level":
      return "bg-[#fff5e8] text-[#d68a2b]";
    case "streak":
      return "bg-[#ecf8f5] text-[#2f8d79]";
    default:
      return "bg-[#eef4ff] text-[#3d70df]";
  }
}

function getScoreTone(score: number) {
  if (score >= 75) {
    return "bg-[#edf8ef] text-[#4aa05f]";
  }

  if (score >= 40) {
    return "bg-[#fff6e8] text-[#da9b2d]";
  }

  return "bg-[#fff0f0] text-[#dd666b]";
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
      return t("today_plan_title");
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
    <div className="inline-flex items-center gap-3 px-3 py-1.5">
      <div className="flex h-9 w-9 items-center justify-center text-primary">
        {icon}
      </div>
      <div className="min-w-0">
        {value ? (
          <p className="text-[1.1rem] font-semibold leading-none text-on-surface">
            {value}
          </p>
        ) : null}
        {label ? (
          <p className="mt-1 text-xs text-on-surface-variant">{label}</p>
        ) : null}
        {children}
      </div>
    </div>
  );
}

function QuickActionCard({
  action,
}: {
  action: DashboardQuickAction;
}) {
  const t = useTranslations("dashboard.home");
  const Icon = ACTION_ICONS[action.key];

  const content = (
    <div className="group flex min-h-[52px] items-center gap-3 rounded-[1rem] border border-outline-variant/12 bg-surface-container-lowest px-3 py-2 shadow-[0_16px_48px_-42px_rgba(22,39,91,0.42)] transition-all hover:-translate-y-0.5 hover:border-primary/20">
      <div
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${getActionTone(
          action.key
        )}`}
      >
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[0.92rem] font-semibold text-on-surface">
            {t(`action_${action.key}_title`)}
          </p>
          {action.status === "coming-soon" ? (
            <span className="rounded-full border border-outline-variant/15 bg-surface-container-low px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              {t("coming_soon")}
            </span>
          ) : null}
        </div>
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 text-on-surface-variant transition-transform group-hover:translate-x-0.5" />
    </div>
  );

  if (action.href && action.status === "live") {
    return <Link href={action.href}>{content}</Link>;
  }

  return content;
}

function RecentActivityCard({
  items,
}: {
  items: DashboardRecentItem[];
}) {
  const t = useTranslations("dashboard.home");
  const tProfile = useTranslations("dashboard.profile");

  return (
    <section className="flex min-h-0 flex-col rounded-[1.55rem] border border-outline-variant/20 bg-surface-container-lowest p-3 shadow-[0_24px_70px_-56px_rgba(22,39,91,0.42)]">
      <div className="mb-2 flex min-h-[32px] items-center justify-between gap-3">
        <h2 className="text-[1.05rem] font-semibold text-on-surface">
          {t("recent_practice")}
        </h2>
        <Link
          href="/history"
          className="rounded-xl border border-outline-variant/15 bg-surface-container-low px-3 py-1.5 text-xs font-medium text-primary"
        >
          {t("view_all")}
        </Link>
      </div>

      {items.length === 0 ? (
        <Link href="/practice" className="block rounded-[1.3rem] border border-dashed border-outline-variant/20 bg-surface-container-low px-4 py-5 text-sm text-on-surface-variant">
          {t("empty_recent_activity")}
        </Link>
      ) : (
        <div className="flex flex-col gap-1.5">
          {items.map((item) => {
            const metricPill =
              item.scoreOutOf100 != null ? (
                <span
                  className={cn(
                    "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                    getScoreTone(item.scoreOutOf100)
                  )}
                >
                  <Star className="h-3.5 w-3.5 fill-current" />
                  {item.scoreOutOf100}
                  <span className="font-medium opacity-75">/100</span>
                </span>
              ) : item.progressPercent != null ? (
                <span className="inline-flex shrink-0 rounded-full bg-[#eef4ff] px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                  {item.progressPercent}%
                </span>
              ) : null;
            const body = (
              <div className="group min-h-[60px] rounded-[13px] border border-[#e3ebf8] bg-surface-container-lowest px-3 py-2 transition-all hover:border-[#c9d8f7] hover:shadow-[0_12px_22px_-24px_rgba(22,39,91,0.22)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-[3px] text-[10px] font-semibold leading-none",
                          getRecentKindTone(item.kind)
                        )}
                      >
                        {getRecentKindLabel(item, t)}
                      </span>
                      {item.statusLabel ? (
                        <span className="rounded-full bg-[#f4f7ff] px-2.5 py-[3px] text-[10px] font-semibold leading-none text-[#6f809e]">
                          {item.statusLabel}
                        </span>
                      ) : null}
                    </div>

                    <p className="mt-1 line-clamp-1 text-[0.9rem] font-semibold leading-snug text-on-surface">
                      {item.title}
                    </p>
                  </div>

                  {metricPill}
                </div>

                <div className="mt-1 flex justify-end text-[11px] text-on-surface-variant">
                  <span className="inline-flex shrink-0 items-center gap-1">
                    <Clock3 className="h-3 w-3" />
                    {formatRelativeTime(item.createdAt, tProfile)}
                  </span>
                </div>
              </div>
            );

            return item.href ? (
              <Link key={item.id} href={item.href}>
                {body}
              </Link>
            ) : (
              <div key={item.id}>{body}</div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function RecommendedDrillPanel({
  drill,
}: {
  drill: DashboardRecommendedDrill;
}) {
  const t = useTranslations("dashboard.home");
  const Icon = TASK_ICONS[drill.key];
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
    <section
      data-testid="dashboard-recommended-panel"
      className="relative overflow-hidden rounded-[1.55rem] border border-outline-variant/20 bg-gradient-to-br from-surface-container-lowest via-white to-[#edf4ff] shadow-[0_28px_90px_-60px_rgba(11,20,36,0.22)]"
    >
      <div className="grid min-h-[330px] gap-3 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(270px,0.78fr)] xl:min-h-[340px] 2xl:min-h-[390px] 2xl:grid-cols-[minmax(0,0.9fr)_minmax(430px,0.9fr)]">
        <div className="relative z-10 flex min-w-0 flex-col">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase text-primary">
            <Star className="h-3.5 w-3.5 fill-current" />
            {t("recommended_label")}
          </span>

          <h1 className="mt-4 max-w-2xl text-[1.8rem] font-bold leading-tight text-on-surface sm:text-[2rem] xl:text-[2.15rem] 2xl:text-[2.45rem]">
            {getPlanTitle(drill, t)}
          </h1>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-container px-3 py-1 text-xs font-semibold text-primary">
              <Clock3 className="h-3.5 w-3.5" />
              {t("recommended_meta_duration", {
                count: drill.durationMinutes,
              })}
            </span>
            {targetLabel ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/75 px-3 py-1 text-xs font-semibold text-on-surface-variant shadow-[inset_0_0_0_1px_rgba(74,94,144,0.12)]">
                <Target className="h-3.5 w-3.5 text-warning" />
                {targetLabel}
              </span>
            ) : null}
            {scoreLabel ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/75 px-3 py-1 text-xs font-semibold text-on-surface-variant shadow-[inset_0_0_0_1px_rgba(74,94,144,0.12)]">
                <Star className="h-3.5 w-3.5 text-primary" />
                {scoreLabel}
              </span>
            ) : null}
          </div>

          <p className="mt-3 max-w-xl text-sm leading-6 text-on-surface-variant">
            {getPlanDescription(drill, t)}
          </p>

          <div className="mt-4 grid grid-cols-1 gap-2 min-[520px]:grid-cols-[minmax(96px,0.9fr)_minmax(140px,1.2fr)_minmax(64px,0.65fr)]">
            <div className="rounded-xl border border-outline-variant/16 bg-white/70 px-3 py-2">
              <p className="text-[11px] font-medium text-on-surface-variant">
                {t("recommended_detail_reason")}
              </p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-on-surface">
                {getPlanReason(drill, t)}
              </p>
            </div>
            <div className="rounded-xl border border-outline-variant/16 bg-white/70 px-3 py-2">
              <p className="text-[11px] font-medium text-on-surface-variant">
                {t("recommended_detail_context")}
              </p>
              <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-on-surface">
                {drill.context ??
                  (drill.track ? getPlanTrackLabel(drill.track, t) : t("recommended_context_fallback"))}
              </p>
            </div>
            <div className="rounded-xl border border-outline-variant/16 bg-white/70 px-3 py-2">
              <p className="text-[11px] font-medium text-on-surface-variant">
                {t("recommended_detail_time")}
              </p>
              <p className="mt-1 text-sm font-semibold leading-5 text-on-surface">
                {t("plan_detail_minutes", { count: drill.durationMinutes })}
              </p>
            </div>
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-3 pt-4">
            <Link href={drill.href} data-testid="dashboard-recommended-cta">
              <Button className="min-h-12 rounded-2xl bg-primary px-5 text-[0.95rem] font-semibold text-on-primary shadow-[0_18px_34px_-22px_rgba(62,120,236,0.9)] hover:bg-primary/95">
                <Icon className="mr-2 h-4 w-4" />
                {getPlanCtaLabel(drill, t)}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            {drill.detailHref && drill.detailHref !== drill.href ? (
              <Link href={drill.detailHref}>
                <Button
                  variant="outline"
                  className="min-h-12 rounded-2xl border-primary/15 bg-white/75 px-5 text-[0.95rem] font-semibold text-on-surface hover:bg-[#eef4ff]"
                >
                  {t("recommended_secondary_cta")}
                </Button>
              </Link>
            ) : null}
          </div>
        </div>

        <div
          data-testid="dashboard-recommended-illustration"
          className="relative min-h-[210px] overflow-hidden rounded-[1.25rem] bg-gradient-to-br from-white/40 to-[#dfeaff]/70 lg:min-h-full"
        >
          <Image
            src="/images/dashboard/recommended-drill.webp"
            alt=""
            fill
            sizes="(max-width: 1024px) 100vw, (max-width: 1536px) 34vw, 430px"
            priority
            className="object-cover object-[56%_52%]"
          />
        </div>
      </div>
    </section>
  );
}

function TodayPlanPanel({
  items,
}: {
  items: DashboardTodayPlanItem[];
}) {
  const t = useTranslations("dashboard.home");

  return (
    <section
      data-testid="dashboard-today-plan"
      className="flex min-h-0 flex-col rounded-[1.55rem] border border-outline-variant/20 bg-surface-container-lowest p-4 shadow-[0_24px_70px_-56px_rgba(22,39,91,0.42)]"
    >
      <div className="mb-3 flex min-h-[32px] items-center justify-between gap-3">
        <h2 className="text-[1.05rem] font-semibold text-on-surface">
          {t("today_plan_title")}
        </h2>
        <Link
          href="/practice"
          className="rounded-xl border border-outline-variant/15 bg-surface-container-low px-3 py-1.5 text-xs font-medium text-primary"
        >
          {t("view_all")}
        </Link>
      </div>

      <div className="flex flex-col gap-1.5">
        {items.map((item) => {
          const Icon = TASK_ICONS[item.key];
          const context =
            item.context ??
            (item.track ? getPlanTrackLabel(item.track, t) : t("recommended_context_fallback"));

          const body = (
            <div className="group grid min-h-[76px] grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-[1rem] border border-[#e3ebf8] bg-surface-container-lowest px-3 py-2 transition-all hover:border-[#c9d8f7] hover:shadow-[0_12px_22px_-24px_rgba(22,39,91,0.22)]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-[18px] w-[18px]" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-[11px] font-semibold leading-4 text-primary">
                  {getPlanReason(item, t)}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[0.9rem] font-semibold leading-[1.15rem] text-on-surface">
                  {getPlanTitle(item, t)}
                </p>
                <p className="mt-0.5 line-clamp-1 text-[11px] leading-4 text-on-surface-variant">
                  {t("today_plan_meta", {
                    duration: item.durationMinutes,
                    context,
                  })}
                </p>
              </div>

              <div className="shrink-0">
                <span className="inline-flex whitespace-nowrap rounded-xl bg-[#eef4ff] px-3 py-2 text-xs font-semibold text-primary shadow-[inset_0_0_0_1px_rgba(77,134,247,0.12)]">
                  {getPlanCtaLabel(item, t)}
                </span>
              </div>
            </div>
          );

          return (
            <Link key={item.id} href={item.href} data-testid="dashboard-today-plan-row">
              {body}
            </Link>
          );
        })}
      </div>

      <p className="mt-auto flex items-center gap-2 pt-4 text-xs text-on-surface-variant">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        {t("today_plan_tip")}
      </p>
    </section>
  );
}

function ProgressCard({
  metrics,
}: {
  metrics: DashboardProgressMetric[];
}) {
  const t = useTranslations("dashboard.home");

  return (
    <section className="flex min-h-0 flex-col rounded-[1.55rem] border border-outline-variant/20 bg-surface-container-lowest p-3 shadow-[0_24px_70px_-56px_rgba(22,39,91,0.42)]">
      <div className="mb-2 min-h-[32px]">
        <h2 className="text-[1.05rem] font-semibold text-on-surface">
          {t("progress_title")}
        </h2>
      </div>

      <div className="flex flex-col gap-1.5">
        {metrics.map((metric) => {
          const Icon = PROGRESS_ICONS[metric.key];

          return (
            <div
              key={metric.key}
              className={`${PANEL_ROW_CLASS} grid-cols-[auto_minmax(0,1fr)_auto]`}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="line-clamp-1 text-[0.92rem] font-medium leading-5 text-on-surface">
                  {t(`progress_metrics.${metric.key}.title`)}
                </p>
                <p className="mt-0.5 line-clamp-1 text-[11px] text-on-surface-variant">
                  {t(`progress_metrics.${metric.key}.subtitle`)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[1rem] font-semibold text-on-surface">
                  {metric.displayValue}
                </p>
                <p className={cn("mt-0.5 text-[11px]", deltaClass(metric.delta))}>
                  {metric.delta == null
                    ? t("delta_none")
                    : `${deltaPrefix(metric.delta)}${metric.delta} ${t("delta_vs_last_week")}`}
                </p>
              </div>
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
  const [copied, setCopied] = useState(false);

  return (
    <div className="grid gap-4 lg:hidden">
      <div className="rounded-[1.5rem] border border-outline-variant/20 bg-surface-container-lowest p-5 shadow-[0_24px_70px_-56px_rgba(22,39,91,0.42)]">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-on-surface">
              {t("invite_friend_title")}
            </p>
            <p className="text-sm text-primary">
              {t("invite_friend_reward", { count: inviteReward })}
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          disabled={!referralCode}
          onClick={() => {
            if (!referralCode) return;
            navigator.clipboard.writeText(`${window.location.origin}/join/${referralCode}`);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
          }}
          className="mt-4 w-full rounded-xl border-outline-variant/15 bg-surface-container-low"
        >
          <Copy className="mr-2 h-4 w-4" />
          {copied ? t("referral_copied") : t("invite_friend_cta")}
        </Button>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <Link href="/settings">
            <Button
              variant="outline"
              className="w-full rounded-xl border-outline-variant/15 bg-surface-container-low"
            >
              <Settings className="mr-2 h-4 w-4" />
              {t("settings_label")}
            </Button>
          </Link>
          <Button
            variant="outline"
            className="w-full rounded-xl border-outline-variant/15 bg-surface-container-low"
          >
            <HelpCircle className="mr-2 h-4 w-4" />
            {t("help_support")}
          </Button>
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

export function DashboardContent({
  data,
  displayName,
  userId,
  showWelcome,
}: DashboardContentProps) {
  const t = useTranslations("dashboard.home");
  const topBar = data.topBar;

  const currentXpInLevel = topBar.xpCurrent % topBar.xpGoal;

  return (
    <PageTransition className="min-h-full bg-background">
      <ProductPageShell>
      <PageContainer size="wide" className="flex flex-col py-3 lg:py-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-on-surface">
          <p className="min-w-0 text-[1rem] font-medium text-on-surface">
            {t(getTimeGreetingKey())}, {displayName}!{" "}
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
            <div className="hidden h-10 w-px bg-outline-variant/35 sm:block" />
            <UtilityChip
              icon={<Sparkles className="h-5 w-5 text-[#F5B942]" />}
              label={t("topbar_orbs")}
              value={topBar.orbBalance.toLocaleString()}
            />
            <div className="hidden h-10 w-px bg-outline-variant/35 sm:block" />
            <UtilityChip
              icon={<Star className="h-5 w-5 text-primary" />}
              label=""
              value={t("level", { level: topBar.level })}
            >
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-on-surface-variant">
                  {currentXpInLevel} / {topBar.xpGoal} XP
                </span>
                <Progress
                  value={(currentXpInLevel / topBar.xpGoal) * 100}
                  className="h-1.5 w-20 bg-surface-container-high"
                />
              </div>
            </UtilityChip>
          </div>
        </div>

        {showWelcome ? (
          <WelcomeBanner displayName={displayName} userId={userId} show />
        ) : null}

        <div className="flex flex-col gap-3">
          <section className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(310px,0.48fr)] 2xl:grid-cols-[minmax(0,1.42fr)_minmax(420px,0.72fr)]">
            <RecommendedDrillPanel drill={data.recommendedDrill} />
            <TodayPlanPanel items={data.todayPlanItems} />
          </section>

          <section
            aria-label={t("quick_actions_label")}
            className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-4"
          >
            {data.quickActions.map((action) => (
              <QuickActionCard key={action.key} action={action} />
            ))}
          </section>

          <section className="grid gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)] 2xl:grid-cols-[minmax(0,1.1fr)_minmax(500px,0.9fr)] 2xl:items-start">
            <RecentActivityCard items={data.recentActivity} />
            <div className="grid gap-3">
              <ProgressCard metrics={data.progress} />
              <SkillSnapshotCard snapshot={data.skillSnapshot} compact />
            </div>
          </section>

          <MobileSupportCards
            referralCode={data.sidebarCards.referralCode}
            inviteReward={data.sidebarCards.inviteOrbs}
          />
        </div>
      </PageContainer>
      </ProductPageShell>
    </PageTransition>
  );
}
