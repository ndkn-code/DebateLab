"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  BookOpen,
  Check,
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
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import { Progress } from "@/components/ui/progress";
import { PageTransition } from "@/components/shared/page-motion";
import { WelcomeBanner } from "@/components/onboarding/welcome-banner";
import { cn } from "@/lib/utils";
import type {
  DashboardHomeData,
  DashboardProgressMetric,
  DashboardQuickAction,
  DashboardRecentItem,
  DashboardTask,
  DailyStatEntry,
} from "@/lib/api/dashboard";
import { SkillSnapshotCard } from "./skill-snapshot-card";
import fireAnimation from "../../../public/lottie/fire.json";

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
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
  "live-match": Scale,
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

function getTaskTitle(
  task: DashboardTask,
  t: ReturnType<typeof useTranslations>
) {
  switch (task.key) {
    case "continue-course":
      return t("next_step_continue_course");
    case "weakest-skill":
      return task.skillKey
        ? t("next_step_skill_title", {
            skill: t(`skill_labels.${task.skillKey}`),
          })
        : t("next_step_skill_title_generic");
    case "underused-track":
      return task.track === "speaking"
        ? t("next_step_underused_speaking")
        : t("next_step_underused_debate");
    case "review-feedback":
      return t("next_step_review_feedback");
    case "live-match":
      return t("next_step_live_match");
    default:
      return t("next_steps_title");
  }
}

function getTaskDescription(
  task: DashboardTask,
  t: ReturnType<typeof useTranslations>
) {
  switch (task.key) {
    case "continue-course":
    case "review-feedback":
      return task.description;
    case "weakest-skill":
      return task.skillKey
        ? t("next_step_skill_desc", {
            skill: t(`skill_labels.${task.skillKey}`),
            score: task.description,
          })
        : task.description;
    case "underused-track":
      return task.track === "speaking"
        ? t("next_step_underused_speaking_desc")
        : t("next_step_underused_debate_desc");
    case "live-match":
      return t("next_step_live_match_desc");
    default:
      return task.description;
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

function HeroWeekWidget({
  weeklyStats,
}: {
  weeklyStats: DailyStatEntry[];
}) {
  const t = useTranslations("dashboard.home");
  const activeDays = weeklyStats.filter(
    (entry) => entry.practice_minutes > 0 || entry.sessions_completed > 0
  ).length;

  return (
    <div className="p-5">
      <div className="flex items-start gap-3">
        <div className="-ml-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center">
          <LottieAnimation
            animationData={fireAnimation}
            className="h-7 w-7"
            loop
          />
        </div>
        <div>
          <p className="text-[1.05rem] font-semibold text-on-surface">
            {activeDays} {t("topbar_streak")}
          </p>
          <p className="text-sm text-on-surface-variant">{t("streak_widget_note")}</p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-7 gap-2">
        {weeklyStats.map((entry, index) => {
          const isActive =
            entry.practice_minutes > 0 || entry.sessions_completed > 0;
          const dayLabel = t(`days_labels.${DAY_KEYS[index]}`).slice(0, 1);

          return (
            <div key={entry.date} className="flex flex-col items-center gap-1.5">
              <span className="text-[11px] font-medium text-on-surface-variant">
                {dayLabel}
              </span>
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-semibold",
                  isActive
                    ? "border-primary bg-primary text-on-primary"
                    : "border-outline-variant/20 bg-surface-container-low text-on-surface-variant"
                )}
              >
                {isActive ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : ""}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HeroGoalWidget({
  practicedMinutes,
  goalMinutes,
  progressPercent,
}: DashboardHomeData["hero"]["todayGoal"]) {
  const t = useTranslations("dashboard.home");

  return (
    <div className="p-5">
      <div className="flex items-center gap-3">
        <Clock3 className="h-5 w-5 shrink-0 text-primary" />
        <div>
          <p className="text-lg font-semibold text-on-surface">
            {t("today_practice_title")}
          </p>
        </div>
      </div>

      <div className="mt-6 flex items-end gap-3">
        <p className="text-[2rem] font-semibold leading-none text-on-surface">
          {practicedMinutes}
          <span className="ml-1 text-sm font-medium text-on-surface-variant">
            {t("min")}
          </span>
        </p>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <span className="shrink-0 text-sm text-on-surface-variant">
          {t("goal_minutes", { count: goalMinutes })}
        </span>
        <Progress
          value={progressPercent}
          className="h-2.5 flex-1 bg-surface-container-high"
        />
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
    <div className="group flex h-full items-center gap-3 rounded-[1.35rem] border border-outline-variant/12 bg-surface-container-lowest px-4 py-3 shadow-[0_24px_70px_-56px_rgba(22,39,91,0.42)] transition-all hover:-translate-y-0.5 hover:border-primary/15">
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[1.1rem] bg-gradient-to-br ${getActionTone(
          action.key
        )}`}
      >
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[1rem] font-semibold text-on-surface">
            {t(`action_${action.key}_title`)}
          </p>
          {action.status === "coming-soon" ? (
            <span className="rounded-full border border-outline-variant/15 bg-surface-container-low px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              {t("coming_soon")}
            </span>
          ) : null}
        </div>

        <p className="mt-0.5 line-clamp-1 text-xs leading-5 text-on-surface-variant">
          {t(action.descriptionKey)}
        </p>
      </div>

      <ChevronRight className="h-5 w-5 shrink-0 text-on-surface-variant transition-transform group-hover:translate-x-0.5" />
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

function NextStepsCard({
  tasks,
}: {
  tasks: DashboardTask[];
}) {
  const t = useTranslations("dashboard.home");

  return (
    <section className="flex min-h-0 flex-col rounded-[1.55rem] border border-outline-variant/20 bg-surface-container-lowest p-3 shadow-[0_24px_70px_-56px_rgba(22,39,91,0.42)]">
      <div className="mb-2 min-h-[32px]">
        <h2 className="text-[1.05rem] font-semibold text-on-surface">
          {t("next_steps_title")}
        </h2>
      </div>

      <div className="flex flex-col gap-1.5">
        {tasks.map((task) => {
          const Icon = TASK_ICONS[task.key];
          const ctaLabel =
            task.status === "coming-soon"
              ? t("coming_soon")
              : task.key === "review-feedback"
                ? t("review")
                : task.key === "continue-course"
                  ? t("continue")
                  : task.key === "live-match"
                    ? t("join_now")
                    : t("open_setup");

          const body = (
            <div className={`${PANEL_ROW_CLASS} grid-cols-[auto_minmax(0,1fr)_auto]`}>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-4 w-4" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="line-clamp-1 text-[0.92rem] font-medium leading-5 text-on-surface">
                  {getTaskTitle(task, t)}
                </p>
                <p className="mt-0.5 line-clamp-1 text-[11px] leading-4 text-on-surface-variant">
                  {getTaskDescription(task, t)}
                </p>
              </div>

              <div className="shrink-0">
                {task.progressLabel ? (
                  <span className="mr-2 rounded-full bg-white/65 px-2 py-0.5 text-[11px] font-medium text-on-surface-variant shadow-[inset_0_0_0_1px_rgba(74,94,144,0.08)]">
                    {task.progressLabel}
                  </span>
                ) : null}

                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium",
                    task.status === "coming-soon"
                      ? "bg-white/65 text-on-surface-variant shadow-[inset_0_0_0_1px_rgba(74,94,144,0.08)]"
                      : "bg-white/70 text-primary shadow-[inset_0_0_0_1px_rgba(77,134,247,0.12)]"
                  )}
                >
                  {ctaLabel}
                </span>
              </div>
            </div>
          );

          return task.href && task.status === "live" ? (
            <Link key={task.key} href={task.href}>
              {body}
            </Link>
          ) : (
            <div key={task.key}>{body}</div>
          );
        })}
      </div>
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
  const hero = data.hero;

  const currentXpInLevel = topBar.xpCurrent % topBar.xpGoal;

  return (
    <PageTransition className="h-screen overflow-hidden bg-background px-4 py-3 sm:px-6 lg:px-8 lg:py-4">
      <div className="mx-auto flex h-full max-w-[1400px] min-h-0 flex-col">
        <div className="mb-3 flex flex-wrap items-center justify-end gap-1 text-on-surface">
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

        {showWelcome ? (
          <WelcomeBanner displayName={displayName} userId={userId} show />
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
          <section className="rounded-[1.7rem] border border-outline-variant/20 bg-gradient-to-br from-background via-surface-container-lowest to-[#EEF4FF] p-4 shadow-[0_28px_90px_-60px_rgba(11,20,36,0.16)]">
            <div className="grid gap-4 xl:grid-cols-[minmax(0,0.88fr)_minmax(560px,1.12fr)]">
              <div className="min-w-0">
                <p className="text-[1.05rem] font-medium text-on-surface">
                  {t(getTimeGreetingKey())}, {displayName}!{" "}
                  <span aria-hidden="true">👋</span>
                </p>
                <h1 className="mt-3 max-w-2xl text-[2.6rem] font-bold tracking-[-0.05em] text-on-surface sm:text-[3.25rem]">
                  {t("hero_title")}
                </h1>

                <div className="mt-6 rounded-[1.45rem] border border-outline-variant/24 bg-surface-container-lowest shadow-[0_20px_60px_-48px_rgba(11,20,36,0.16)]">
                  <div className="grid gap-0 md:grid-cols-[minmax(0,1fr)_1px_minmax(0,1fr)]">
                    <HeroWeekWidget weeklyStats={hero.weeklyStats} />
                    <div className="hidden bg-outline-variant/35 md:block" />
                    <div className="border-t border-outline-variant/20 md:border-t-0">
                      <HeroGoalWidget {...hero.todayGoal} />
                    </div>
                  </div>
                </div>
              </div>

              <SkillSnapshotCard snapshot={data.skillSnapshot} />
            </div>
          </section>

          <section className="grid gap-3 xl:grid-cols-4">
            {data.quickActions.map((action) => (
              <QuickActionCard key={action.key} action={action} />
            ))}
          </section>

          <section className="grid min-h-0 shrink-0 gap-3 overflow-hidden xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)_minmax(280px,0.8fr)] xl:items-start">
            <RecentActivityCard items={data.recentActivity} />
            <NextStepsCard tasks={data.nextSteps} />
            <ProgressCard metrics={data.progress} />
          </section>

          <MobileSupportCards
            referralCode={data.sidebarCards.referralCode}
            inviteReward={data.sidebarCards.inviteOrbs}
          />
        </div>
      </div>
    </PageTransition>
  );
}
