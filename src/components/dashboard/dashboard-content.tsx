"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import {
  Bell,
  BookOpen,
  ChevronRight,
  Clock3,
  Copy,
  Flame,
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
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
import { DashboardSidebarRail } from "./dashboard-sidebar-rail";
import { SkillSnapshotCard } from "./skill-snapshot-card";

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
const ACTION_ICONS = {
  speaking: Mic,
  debate: Users2,
  course: BookOpen,
  coach: Sparkles,
} as const;
const RECENT_ICONS = {
  speaking: Mic,
  debate: Users2,
  course: BookOpen,
  lesson: BookOpen,
  level: Trophy,
  streak: Flame,
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
  "grid min-h-[92px] items-center gap-3 rounded-[1.45rem] bg-[#F5F3FF] px-4 py-4";

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
      return "from-[#3B82F6] to-[#2563EB] text-white";
    case "debate":
      return "from-[#7C5CFA] to-[#5B43D9] text-white";
    case "course":
      return "from-[#34C759] to-[#249B55] text-white";
    case "coach":
      return "from-[#8B5CF6] to-[#6D49D7] text-white";
    default:
      return "from-primary to-primary";
  }
}

function getRecentIconTone(kind: DashboardRecentItem["kind"]) {
  switch (kind) {
    case "speaking":
      return "bg-primary/10 text-primary";
    case "debate":
      return "bg-[#7C5CFA]/10 text-[#7C5CFA]";
    case "course":
    case "lesson":
      return "bg-[#34C759]/10 text-[#249B55]";
    case "level":
      return "bg-[#F59E0B]/10 text-[#F59E0B]";
    case "streak":
      return "bg-[#FB7185]/10 text-[#F43F5E]";
    default:
      return "bg-primary/10 text-primary";
  }
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
        <p className="mt-1 text-xs text-on-surface-variant">{label}</p>
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

  return (
    <div className="rounded-[1.4rem] border border-outline-variant/10 bg-surface-container-lowest p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#FFF4E6] text-[#F59E0B]">
          <Flame className="h-5 w-5" />
        </div>
        <div>
          <p className="text-lg font-semibold text-on-surface">
            {t("streak_title")}
          </p>
          <p className="text-sm text-on-surface-variant">{t("streak_widget_note")}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-7 gap-2">
        {weeklyStats.map((entry, index) => {
          const isActive =
            entry.practice_minutes > 0 || entry.sessions_completed > 0;

          return (
            <div key={entry.date} className="flex flex-col items-center gap-1.5">
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border text-[11px] font-semibold",
                  isActive
                    ? "border-primary bg-primary text-on-primary"
                    : "border-outline-variant/20 bg-surface-container-low text-on-surface-variant"
                )}
              >
                {isActive ? "•" : ""}
              </div>
              <span className="text-[11px] text-on-surface-variant">
                {t(`days_labels.${DAY_KEYS[index]}`)}
              </span>
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
  const metGoal = practicedMinutes >= goalMinutes;

  return (
    <div className="rounded-[1.5rem] border border-outline-variant/15 bg-surface-container-lowest p-4 shadow-[0_20px_60px_-48px_rgba(22,39,91,0.45)]">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Clock3 className="h-5 w-5" />
        </div>
        <div>
          <p className="text-lg font-semibold text-on-surface">
            {t("today_practice_title")}
          </p>
          <p className="text-sm text-on-surface-variant">
            {t("today_practice_note")}
          </p>
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-3">
        <p className="text-[2rem] font-semibold leading-none text-on-surface">
          {practicedMinutes}
          <span className="ml-1 text-sm font-medium text-on-surface-variant">
            {t("min")}
          </span>
        </p>
        <span className="text-sm text-on-surface-variant">
          {t("goal_minutes", { count: goalMinutes })}
        </span>
      </div>

      <p className="mt-2 text-sm text-on-surface-variant">
        {t("today_goal_subtitle")}
      </p>

      <Progress
        value={progressPercent}
        className="mt-4 h-2.5 bg-surface-container-high"
      />

      <p className="mt-4 text-sm text-on-surface-variant">
        {metGoal ? t("goal_complete") : t("goal_keep_going")}
      </p>
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
    <div className="group flex h-full items-center gap-4 rounded-[1.5rem] border border-outline-variant/12 bg-surface-container-lowest px-5 py-4 shadow-[0_24px_70px_-56px_rgba(22,39,91,0.42)] transition-all hover:-translate-y-0.5 hover:border-primary/15">
      <div
        className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-[1.35rem] bg-gradient-to-br ${getActionTone(
          action.key
        )}`}
      >
        <Icon className="h-7 w-7" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-[1.1rem] font-semibold text-on-surface">
            {t(`action_${action.key}_title`)}
          </p>
          {action.status === "coming-soon" ? (
            <span className="rounded-full border border-outline-variant/15 bg-surface-container-low px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-on-surface-variant">
              {t("coming_soon")}
            </span>
          ) : null}
        </div>

        <p className="mt-1 text-sm leading-6 text-on-surface-variant">
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
    <section className="flex h-full flex-col rounded-[1.75rem] border border-outline-variant/12 bg-surface-container-lowest p-5 shadow-[0_24px_70px_-56px_rgba(22,39,91,0.42)]">
      <div className="mb-5 flex min-h-[70px] items-start justify-between gap-3">
        <div>
          <h2 className="text-[1.15rem] font-semibold text-on-surface">
            {t("recent_activity_title")}
          </h2>
          <p className="text-sm text-on-surface-variant">
            {t("recent_activity_subtitle")}
          </p>
        </div>
        <Link
          href="/history"
          className="rounded-xl border border-outline-variant/15 bg-surface-container-low px-3 py-2 text-sm font-medium text-primary"
        >
          {t("view_all")}
        </Link>
      </div>

      {items.length === 0 ? (
        <Link href="/practice" className="block rounded-[1.3rem] border border-dashed border-outline-variant/20 bg-surface-container-low px-4 py-5 text-sm text-on-surface-variant">
          {t("empty_recent_activity")}
        </Link>
      ) : (
        <div className="grid flex-1 auto-rows-fr gap-3">
          {items.map((item) => {
            const Icon = RECENT_ICONS[item.kind];
            const body = (
              <div className={`${PANEL_ROW_CLASS} grid-cols-[auto_minmax(0,1fr)_auto]`}>
                <div
                  className={cn(
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
                    getRecentIconTone(item.kind)
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-[1.02rem] font-medium text-on-surface">
                    {item.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-on-surface-variant">
                    <span>
                      {item.kind === "speaking"
                        ? t("track_speaking")
                        : item.kind === "debate"
                          ? t("track_debate")
                          : item.subtitle}
                    </span>
                    {item.statusLabel ? (
                      <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-medium text-on-surface-variant">
                        {item.statusLabel}
                      </span>
                    ) : null}
                    {item.progressPercent != null ? (
                      <span className="font-medium text-primary">
                        {item.progressPercent}%
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  {item.scoreOutOfFive != null ? (
                    <p className="inline-flex items-center gap-1 text-sm font-semibold text-on-surface">
                      {item.scoreOutOfFive.toFixed(1)}
                      <Star className="h-4 w-4 fill-[#F59E0B] text-[#F59E0B]" />
                    </p>
                  ) : null}
                  <p className="mt-1 text-xs text-on-surface-variant">
                    {formatRelativeTime(item.createdAt, tProfile)}
                  </p>
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
    <section className="flex h-full flex-col rounded-[1.75rem] border border-outline-variant/12 bg-surface-container-lowest p-5 shadow-[0_24px_70px_-56px_rgba(22,39,91,0.42)]">
      <div className="mb-5 min-h-[70px]">
        <h2 className="text-[1.15rem] font-semibold text-on-surface">
          {t("next_steps_title")}
        </h2>
        <p className="text-sm text-on-surface-variant">
          {t("next_steps_subtitle")}
        </p>
      </div>

      <div className="grid flex-1 auto-rows-fr gap-3">
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
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[1.02rem] font-medium text-on-surface">
                  {getTaskTitle(task, t)}
                </p>
                <p className="mt-1 text-xs leading-5 text-on-surface-variant">
                  {getTaskDescription(task, t)}
                </p>
              </div>

              <div className="shrink-0">
                {task.progressLabel ? (
                  <span className="mr-2 rounded-full bg-white/65 px-2.5 py-1 text-xs font-medium text-on-surface-variant shadow-[inset_0_0_0_1px_rgba(74,94,144,0.08)]">
                    {task.progressLabel}
                  </span>
                ) : null}

                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium",
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
    <section className="flex h-full flex-col rounded-[1.75rem] border border-outline-variant/12 bg-surface-container-lowest p-5 shadow-[0_24px_70px_-56px_rgba(22,39,91,0.42)]">
      <div className="mb-5 min-h-[70px]">
        <h2 className="text-[1.15rem] font-semibold text-on-surface">
          {t("progress_title")}
        </h2>
        <p className="text-sm text-on-surface-variant">
          {t("progress_subtitle")}
        </p>
      </div>

      <div className="grid flex-1 auto-rows-fr gap-3">
        {metrics.map((metric) => {
          const Icon = PROGRESS_ICONS[metric.key];

          return (
            <div
              key={metric.key}
              className={`${PANEL_ROW_CLASS} grid-cols-[auto_minmax(0,1fr)_auto]`}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[1.02rem] font-medium text-on-surface">
                  {t(`progress_metrics.${metric.key}.title`)}
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  {t(`progress_metrics.${metric.key}.subtitle`)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[1.05rem] font-semibold text-on-surface">
                  {metric.displayValue}
                </p>
                <p className={cn("mt-1 text-xs", deltaClass(metric.delta))}>
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
      <div className="rounded-[1.5rem] border border-outline-variant/12 bg-surface-container-lowest p-5 shadow-[0_24px_70px_-56px_rgba(22,39,91,0.42)]">
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
  const profile = data.profile;
  const initials = useMemo(
    () =>
      displayName
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase(),
    [displayName]
  );

  const currentXpInLevel = topBar.xpCurrent % topBar.xpGoal;

  return (
    <div className="min-h-screen bg-background">
      <div className="grid min-h-screen lg:grid-cols-[280px_minmax(0,1fr)]">
        <DashboardSidebarRail
          navItems={data.nav}
          referralCode={data.sidebarCards.referralCode}
          inviteReward={data.sidebarCards.inviteOrbs}
        />

        <main className="min-w-0 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
          <div className="mx-auto max-w-[1400px]">
            <div className="mb-5 flex flex-wrap items-center justify-end gap-1 text-on-surface">
              <UtilityChip
                icon={<Flame className="h-5 w-5 text-[#F97316]" />}
                label={t("topbar_streak")}
                value={topBar.currentStreak}
              />
              <div className="hidden h-10 w-px bg-outline-variant/20 sm:block" />
              <UtilityChip
                icon={<Sparkles className="h-5 w-5 text-[#F59E0B]" />}
                label={t("topbar_orbs")}
                value={topBar.orbBalance.toLocaleString()}
              />
              <div className="hidden h-10 w-px bg-outline-variant/20 sm:block" />
              <UtilityChip
                icon={<Star className="h-5 w-5 text-primary" />}
                label={t("topbar_level")}
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
              <div className="hidden h-10 w-px bg-outline-variant/20 sm:block" />

              <button
                type="button"
                disabled
                className="inline-flex h-10 w-10 items-center justify-center text-on-surface-variant disabled:cursor-not-allowed"
              >
                <Bell className="h-5 w-5" />
              </button>
              <div className="hidden h-10 w-px bg-outline-variant/20 sm:block" />

              <div className="inline-flex items-center gap-3 px-3 py-1.5">
                <Avatar size="sm">
                  {profile?.avatar_url ? (
                    <AvatarImage src={profile.avatar_url} alt={displayName} />
                  ) : null}
                  <AvatarFallback className="bg-primary-container text-on-primary-container text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-on-surface">{displayName}</p>
                  <p className="text-xs text-on-surface-variant">
                    {profile?.role ?? t("student")}
                  </p>
                </div>
              </div>
            </div>

            {showWelcome ? (
              <WelcomeBanner displayName={displayName} userId={userId} show />
            ) : null}

            <div className="space-y-5">
              <section className="rounded-[2rem] border border-outline-variant/12 bg-gradient-to-br from-[#F6F9FF] via-surface-container-lowest to-[#FBFCFF] p-5 shadow-[0_28px_90px_-60px_rgba(22,39,91,0.38)] md:p-6">
                <div className="grid gap-6 xl:grid-cols-[minmax(0,0.88fr)_minmax(560px,1.12fr)]">
                  <div className="min-w-0">
                    <p className="text-[1.05rem] font-medium text-on-surface">
                      {t(getTimeGreetingKey())}, {displayName}!{" "}
                      <span aria-hidden="true">👋</span>
                    </p>
                    <h1 className="mt-3 max-w-2xl text-[2.6rem] font-bold tracking-[-0.05em] text-on-surface sm:text-[3.25rem]">
                      {t("hero_title")}
                    </h1>
                    <p className="mt-4 max-w-2xl text-[1.2rem] leading-8 text-on-surface-variant">
                      {t("hero_subtitle")}
                    </p>

                    <div className="mt-6 grid gap-4 md:grid-cols-2">
                      <HeroWeekWidget weeklyStats={hero.weeklyStats} />
                      <HeroGoalWidget {...hero.todayGoal} />
                    </div>
                  </div>

                  <SkillSnapshotCard snapshot={data.skillSnapshot} />
                </div>
              </section>

              <section className="grid gap-4 xl:grid-cols-4">
                {data.quickActions.map((action) => (
                  <QuickActionCard key={action.key} action={action} />
                ))}
              </section>

              <section className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)_minmax(280px,0.8fr)] xl:items-stretch">
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
        </main>
      </div>
    </div>
  );
}
