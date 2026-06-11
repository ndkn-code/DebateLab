"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { useLocale, useTranslations } from "next-intl";
import {
  CheckCircle2,
  ChevronRight,
  Clock3,
  Gift,
  Sparkles,
  Zap,
} from "@/components/ui/icons";
import { ReferralCreditsDialog } from "@/components/shared/referral-credits-dialog";
import { cn } from "@/lib/utils";
import type { DashboardHomeData } from "@/lib/api/dashboard";
import type {
  DailyStatEntry,
  DashboardGoalSummary,
} from "@thinkfy/shared/dashboard";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;
const XP_QUEST_GOAL = 50;

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
        "rounded-[1.5rem] border border-outline-variant bg-surface p-5 shadow-token-card dark:border-outline-variant/70",
        className
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

// --- Level card ---------------------------------------------------------

function LevelCard({ topBar }: { topBar: DashboardHomeData["topBar"] }) {
  const t = useTranslations("dashboard.home");
  const progress = Math.min(
    100,
    Math.round((topBar.xpCurrent / Math.max(topBar.xpGoal, 1)) * 100)
  );

  return (
    <RailCard testId="dashboard-level-card">
      <div className="flex items-center gap-4">
        <div className="relative flex h-14 w-14 shrink-0 items-center justify-center">
          <Image
            src="/images/rewards/league-gold.webp"
            alt=""
            aria-hidden="true"
            width={1254}
            height={1254}
            className="h-14 w-14 object-contain"
            sizes="56px"
          />
          <span className="absolute translate-y-[3px] text-[15px] font-extrabold text-[#8A5C00]">
            {topBar.level}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-extrabold text-on-surface">
            {t("level", { level: topBar.level })}
          </p>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-surface-container-high">
            <motion.div
              initial={{ width: 0 }}
              whileInView={{ width: `${progress}%` }}
              viewport={{ once: true }}
              transition={{ duration: 1, ease: EASE_OUT, delay: 0.2 }}
              className="h-full rounded-full bg-reward"
            />
          </div>
          <p className="mt-1.5 text-[12px] font-bold text-on-surface-variant">
            {topBar.xpCurrent} / {topBar.xpGoal} XP
          </p>
        </div>
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
  const done = quest.current >= quest.goal;
  const percent = Math.min(100, (quest.current / Math.max(quest.goal, 1)) * 100);

  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
          done ? "bg-success-container text-success-dim" : "bg-warning-container text-reward-dim"
        )}
      >
        {done ? <CheckCircle2 className="h-5 w-5" /> : quest.icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-extrabold text-on-surface">{quest.label}</p>
        <div className="relative mt-1.5 h-3.5 overflow-hidden rounded-full bg-surface-container-high">
          <motion.div
            initial={{ width: 0 }}
            whileInView={{ width: `${percent}%` }}
            viewport={{ once: true }}
            transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.15 + index * 0.12 }}
            className={cn(
              "h-full rounded-full",
              done ? "bg-success" : "bg-reward"
            )}
          />
          <span className="absolute inset-0 flex items-center justify-center text-[10px] font-extrabold text-on-surface/70">
            {Math.min(quest.current, quest.goal)} / {quest.goal}
          </span>
        </div>
      </div>
      <Image
        src={done ? "/images/rewards/chest-open.webp" : "/images/rewards/chest-closed.webp"}
        alt=""
        aria-hidden="true"
        width={1254}
        height={1254}
        className={cn("h-9 w-9 shrink-0 object-contain", !done && "opacity-80")}
        sizes="36px"
      />
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
    {
      id: "xp",
      icon: <Zap className="h-5 w-5" />,
      label: t("quest_earn_xp", { count: XP_QUEST_GOAL }),
      current: today?.xp_earned ?? 0,
      goal: XP_QUEST_GOAL,
    },
  ];

  return (
    <RailCard testId="dashboard-daily-quests">
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-extrabold text-on-surface">{t("quests_title")}</p>
        <Zap className="h-[18px] w-[18px] text-reward" />
      </div>
      <div className="mt-4 flex flex-col gap-4">
        {quests.map((quest, index) => (
          <QuestRow key={quest.id} quest={quest} index={index} />
        ))}
      </div>
    </RailCard>
  );
}

// --- Streak --------------------------------------------------------------

function StreakRailCard({
  streak,
  weeklyStats,
}: {
  streak: number;
  weeklyStats: DailyStatEntry[];
}) {
  const t = useTranslations("dashboard.home");
  const locale = useLocale();
  const days = useMemo(() => weeklyStats.slice(-7), [weeklyStats]);

  return (
    <RailCard testId="dashboard-streak-rail">
      <div className="flex items-center gap-3.5">
        <Image
          src="/images/rewards/streak-fire.webp"
          alt=""
          aria-hidden="true"
          width={1254}
          height={1254}
          className={cn("h-11 w-11 object-contain", streak === 0 && "opacity-40 grayscale")}
          sizes="44px"
        />
        <div>
          <p className="text-[1.45rem] font-extrabold leading-none text-on-surface">
            {streak}{" "}
            <span className="text-[14px] font-bold text-on-surface-variant">{t("days")}</span>
          </p>
          <p className="mt-1 text-[12px] font-bold text-on-surface-variant">
            {t("streak_title")}
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        {days.map((entry) => {
          const active = entry.sessions_completed > 0 || entry.practice_minutes > 0;
          const initial = new Date(`${entry.date}T12:00:00`).toLocaleDateString(locale, {
            weekday: "narrow",
          });
          return (
            <div key={entry.date} className="flex flex-col items-center gap-1.5">
              <span
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full",
                  active
                    ? "bg-[#FF9F45] text-white"
                    : "border-2 border-dashed border-outline-variant bg-surface"
                )}
              >
                {active ? <CheckCircle2 className="h-4 w-4" /> : null}
              </span>
              <span className="text-[10px] font-extrabold uppercase text-on-surface-variant">
                {initial}
              </span>
            </div>
          );
        })}
      </div>
    </RailCard>
  );
}

// --- Invite --------------------------------------------------------------

function InviteRailCard({
  referralCode,
  inviteReward,
}: {
  referralCode: string | null;
  inviteReward: number;
}) {
  const t = useTranslations("dashboard.home");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        disabled={!referralCode}
        data-testid="dashboard-mobile-referral-card"
        onClick={() => referralCode && setOpen(true)}
        className="group flex w-full items-center gap-3 rounded-[1.5rem] border border-outline-variant bg-surface p-5 text-left shadow-token-card transition-all hover:-translate-y-0.5 hover:border-primary-fixed disabled:cursor-not-allowed disabled:opacity-60 dark:border-outline-variant/70"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-container text-primary">
          <Gift className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13.5px] font-extrabold text-on-surface">
            {t("invite_friend_title")}
          </span>
          <span className="block text-[12px] font-bold text-primary">
            {t("invite_friend_reward", { count: inviteReward })}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-on-surface-variant transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
      </button>
      <ReferralCreditsDialog
        open={open}
        onOpenChange={setOpen}
        referralCode={referralCode}
        inviteReward={inviteReward}
      />
    </>
  );
}

// --- Rail ----------------------------------------------------------------

export function QuestRail({ data }: { data: DashboardHomeData }) {
  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-5">
      <LevelCard topBar={data.topBar} />
      <DailyQuestsCard
        todayGoal={data.hero.todayGoal}
        weeklyStats={data.hero.weeklyStats}
      />
      <StreakRailCard
        streak={data.topBar.currentStreak}
        weeklyStats={data.hero.weeklyStats}
      />
      <InviteRailCard
        referralCode={data.sidebarCards.referralCode}
        inviteReward={data.sidebarCards.inviteOrbs}
      />
    </aside>
  );
}
