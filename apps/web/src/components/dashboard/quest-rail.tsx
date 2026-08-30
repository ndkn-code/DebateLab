"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import {
  Award,
  CheckCircle2,
  Clock3,
  Flame,
  Sparkles,
  Target,
  Zap,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import type { DashboardHomeData } from "@/lib/api/dashboard";
import type {
  DailyStatEntry,
  DashboardGoalSummary,
} from "@thinkfy/shared/dashboard";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
function RailCard({
  children,
  className,
  testId,
}: {
  children: React.ReactNode;
  className?: string;
  testId?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "rounded-xl border border-outline-variant bg-surface p-3.5 shadow-none dark:border-outline-variant/70",
        className,
      )}
    >
      {children}
    </div>
  );
}

function findToday(weeklyStats: DailyStatEntry[]): DailyStatEntry | null {
  if (!weeklyStats.length) return null;
  const now = new Date();
  const localKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return (
    weeklyStats.find((entry) => entry.date === localKey) ??
    weeklyStats[weeklyStats.length - 1]
  );
}

function clampProgressValue(value: number, max: number) {
  return Math.max(0, Math.min(value, Math.max(max, 1)));
}

function SignalIcon({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "blue" | "green" | "amber";
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
        tone === "blue" && "bg-primary-container text-primary",
        tone === "green" && "bg-success-container text-success-dim",
        tone === "amber" && "bg-warning-container text-reward-dim",
      )}
    >
      {children}
    </span>
  );
}

function SignalRow({
  icon,
  label,
  value,
  detail,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3">
      {icon}
      <div className="min-w-0 flex-1">
        <p className="type-caption font-semibold text-on-surface-variant">
          {label}
        </p>
        <p className="type-body-sm mt-0.5 font-bold tabular-nums text-on-surface">
          {value}
        </p>
        {detail ? (
          <p className="type-caption mt-0.5 truncate text-on-surface-variant">
            {detail}
          </p>
        ) : null}
        {children}
      </div>
    </div>
  );
}

// --- Today / readiness card --------------------------------------------

function ReadinessCard({
  topBar,
  todayGoal,
  weeklyStats,
}: {
  topBar: DashboardHomeData["topBar"];
  todayGoal: DashboardGoalSummary;
  weeklyStats: DailyStatEntry[];
}) {
  const t = useTranslations("dashboard.home");
  const reduceMotion = useReducedMotion();
  const goalProgress = Math.min(100, Math.max(0, todayGoal.progressPercent));
  const todayGoalMax = Math.max(todayGoal.goalMinutes, 1);
  const xpGoalMax = Math.max(topBar.xpGoal, 1);
  const levelProgress = Math.min(
    100,
    Math.max(
      0,
      Math.round((topBar.xpCurrent / Math.max(topBar.xpGoal, 1)) * 100),
    ),
  );
  const recentDays = weeklyStats.slice(-7);
  const activeDays = recentDays.filter(
    (entry) => entry.practice_minutes > 0 || entry.sessions_completed > 0,
  ).length;
  const goalValue = `${todayGoal.practicedMinutes} / ${todayGoal.goalMinutes} ${t("min")}`;
  const levelValue = t("level", { level: topBar.level });
  const streakValue = `${topBar.currentStreak} ${t("days")}`;

  return (
    <RailCard testId="dashboard-level-card" className="p-3.5">
      <div className="space-y-3">
        <SignalRow
          icon={
            <SignalIcon tone="blue">
              <Target className="h-[18px] w-[18px]" />
            </SignalIcon>
          }
          label={t("today_goal_title")}
          value={goalValue}
        >
          <div className="mt-1.5 flex items-center gap-2">
            <div
              className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-container-high"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={todayGoalMax}
              aria-valuenow={clampProgressValue(
                todayGoal.practicedMinutes,
                todayGoalMax,
              )}
              aria-label={t("today_goal_subtitle")}
            >
              <motion.div
                initial={reduceMotion ? false : { width: 0 }}
                whileInView={{ width: `${goalProgress}%` }}
                viewport={{ once: true }}
                transition={
                  reduceMotion
                    ? { duration: 0 }
                    : { duration: 0.8, ease: EASE_OUT, delay: 0.15 }
                }
                className={cn(
                  "h-full rounded-full",
                  todayGoal.metGoal ? "bg-success" : "bg-primary",
                )}
              />
            </div>
            <span className="type-caption shrink-0 font-semibold tabular-nums text-on-surface-variant">
              {goalProgress}%
            </span>
          </div>
        </SignalRow>

        <div className="border-t border-outline-variant/60" />

        <SignalRow
          icon={
            <SignalIcon tone="amber">
              <Award className="h-[18px] w-[18px]" />
            </SignalIcon>
          }
          label={t("topbar_level")}
          value={levelValue}
          detail={`${topBar.xpCurrent} / ${topBar.xpGoal} XP`}
        >
          <div
            className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-container-high"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={xpGoalMax}
            aria-valuenow={clampProgressValue(topBar.xpCurrent, xpGoalMax)}
            aria-label={t("stats.level_progress", {
              current: topBar.xpCurrent,
              goal: topBar.xpGoal,
            })}
          >
            <motion.div
              initial={reduceMotion ? false : { width: 0 }}
              whileInView={{ width: `${levelProgress}%` }}
              viewport={{ once: true }}
              transition={
                reduceMotion
                  ? { duration: 0 }
                  : { duration: 0.8, ease: EASE_OUT, delay: 0.2 }
              }
              className="h-full rounded-full bg-reward"
            />
          </div>
        </SignalRow>

        <div className="border-t border-outline-variant/60" />

        <SignalRow
          icon={
            <SignalIcon tone="green">
              <Flame className="h-[18px] w-[18px]" />
            </SignalIcon>
          }
          label={t("streak_title")}
          value={streakValue}
        >
          <div
            className="mt-2 flex items-center gap-1.5"
            aria-label={t("active_days_this_week", { count: activeDays })}
          >
            {recentDays.map((entry) => {
              const active =
                entry.practice_minutes > 0 || entry.sessions_completed > 0;
              return (
                <span
                  key={entry.date}
                  aria-hidden="true"
                  className={cn(
                    "h-2.5 w-2.5 rounded-full",
                    active ? "bg-success" : "bg-surface-container-high",
                  )}
                />
              );
            })}
          </div>
        </SignalRow>
      </div>
    </RailCard>
  );
}

// --- Daily quests --------------------------------------------------------

interface Quest {
  id: string;
  icon: React.ReactNode;
  label: string;
  current: number;
  goal: number;
}

function QuestRow({ quest, index }: { quest: Quest; index: number }) {
  const reduceMotion = useReducedMotion();
  const questMax = Math.max(quest.goal, 1);
  const done = quest.current >= quest.goal;
  const percent = Math.min(
    100,
    Math.max(0, (quest.current / Math.max(quest.goal, 1)) * 100),
  );

  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          done
            ? "bg-success-container text-success-dim"
            : "bg-warning-container text-reward-dim",
        )}
      >
        {done ? <CheckCircle2 className="h-5 w-5" /> : quest.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="type-body-sm truncate font-extrabold text-on-surface">
          {quest.label}
        </p>
        <div
          className="relative mt-1.5 h-3 overflow-hidden rounded-full bg-surface-container-high"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={questMax}
          aria-valuenow={clampProgressValue(quest.current, questMax)}
          aria-label={quest.label}
        >
          <motion.div
            initial={reduceMotion ? false : { width: 0 }}
            whileInView={{ width: `${percent}%` }}
            viewport={{ once: true }}
            transition={
              reduceMotion
                ? { duration: 0 }
                : {
                    duration: 0.9,
                    ease: EASE_OUT,
                    delay: 0.15 + index * 0.12,
                  }
            }
            className={cn(
              "h-full rounded-full",
              done ? "bg-success" : "bg-reward",
            )}
          />
          <span className="type-caption absolute inset-0 flex items-center justify-center font-extrabold text-on-surface/70">
            {clampProgressValue(quest.current, questMax)} / {quest.goal}
          </span>
        </div>
      </div>
      <span
        aria-hidden="true"
        className={cn(
          "type-caption inline-flex h-5 min-w-8 shrink-0 items-center justify-center rounded-md px-1.5 font-semibold tabular-nums",
          done
            ? "bg-success-container text-success-dim"
            : "bg-primary-container text-primary-dim",
        )}
      >
        {done ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : (
          `${Math.round(percent)}%`
        )}
      </span>
    </div>
  );
}

function DailyQuestsCard({
  todayGoal,
  weeklyStats,
}: {
  todayGoal: DashboardGoalSummary;
  weeklyStats: DailyStatEntry[];
}) {
  const t = useTranslations("dashboard.home");
  const today = findToday(weeklyStats);

  const quests: Quest[] = [
    {
      id: "minutes",
      icon: <Clock3 className="h-5 w-5" />,
      label: t("quest_practice_minutes", { count: todayGoal.goalMinutes }),
      current: todayGoal.practicedMinutes,
      goal: todayGoal.goalMinutes,
    },
    {
      id: "session",
      icon: <Sparkles className="h-5 w-5" />,
      label: t("quest_complete_session"),
      current: today?.sessions_completed ?? 0,
      goal: 1,
    },
  ];

  return (
    <RailCard testId="dashboard-daily-quests" className="flex flex-col">
      <div className="flex items-center justify-between">
        <p className="type-body font-extrabold text-on-surface">
          {t("quests_title")}
        </p>
        <Zap className="h-[18px] w-[18px] text-reward" />
      </div>
      <div className="mt-3 flex flex-col gap-3">
        {quests.map((quest, index) => (
          <QuestRow key={quest.id} quest={quest} index={index} />
        ))}
      </div>
    </RailCard>
  );
}

// --- Rail ----------------------------------------------------------------

export function QuestRail({ data }: { data: DashboardHomeData }) {
  const t = useTranslations("dashboard.home");

  return (
    <aside
      aria-label={t("progress_title")}
      className="flex flex-col gap-3 xl:sticky xl:top-5"
    >
      <ReadinessCard
        topBar={data.topBar}
        todayGoal={data.hero.todayGoal}
        weeklyStats={data.hero.weeklyStats}
      />
      <DailyQuestsCard
        todayGoal={data.hero.todayGoal}
        weeklyStats={data.hero.weeklyStats}
      />
    </aside>
  );
}
