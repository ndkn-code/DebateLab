"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { ReferralCreditsDialog } from "@/components/shared/referral-credits-dialog";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Check, Sparkles, Zap } from "@/components/ui/icons";
import { Stat } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { DailyStatEntry, DashboardHomeData } from "@/lib/api/dashboard";

const DAY_KEYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export const CREDIT_ICON_SRC = "/images/rewards/credits-coin.webp";
const STREAK_ICON_SRC = "/images/rewards/streak-fire.webp";

interface DashboardStatsPanelProps {
  topBar: DashboardHomeData["topBar"];
  weeklyStats: DailyStatEntry[];
  referralCode: string | null;
  inviteReward: number;
}

export function DashboardStatsPanel({
  topBar,
  weeklyStats,
  referralCode,
  inviteReward,
}: DashboardStatsPanelProps) {
  const t = useTranslations("dashboard.home");
  const [referralOpen, setReferralOpen] = useState(false);
  const streakCount = formatDashboardNumber(topBar.currentStreak);
  const creditsCount = formatDashboardNumber(topBar.orbBalance);

  return (
    <div
      data-testid="dashboard-stats-panel"
      className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2"
    >
      <StatCounter
        ariaLabel={t("stats.streak_aria")}
        dataTestId="dashboard-stats-streak"
        iconSrc={STREAK_ICON_SRC}
        iconClassName={cn(
          "h-10 w-10 sm:h-11 sm:w-11",
          topBar.currentStreak === 0 && "opacity-40 grayscale"
        )}
        value={streakCount}
      >
        <StreakPopover
          currentStreak={topBar.currentStreak}
          weeklyStats={weeklyStats}
          formattedStreak={streakCount}
        />
      </StatCounter>

      <StatCounter
        ariaLabel={t("stats.credits_aria")}
        dataTestId="dashboard-stats-credits"
        iconSrc={CREDIT_ICON_SRC}
        iconClassName="h-10 w-10 sm:h-11 sm:w-11"
        value={creditsCount}
      >
        <CreditsPopover
          formattedBalance={creditsCount}
          referralCode={referralCode}
          onReferralOpen={() => setReferralOpen(true)}
        />
      </StatCounter>

      <ReferralCreditsDialog
        open={referralOpen}
        onOpenChange={setReferralOpen}
        referralCode={referralCode}
        inviteReward={inviteReward}
      />
    </div>
  );
}

export function StatCounter({
  ariaLabel,
  dataTestId,
  iconSrc,
  iconClassName,
  value,
  children,
}: {
  ariaLabel: string;
  dataTestId: string;
  iconSrc: string;
  iconClassName?: string;
  value: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const openPopover = () => {
    clearCloseTimer();
    setOpen(true);
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setOpen(false), 180);
  };

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        clearCloseTimer();
        setOpen(nextOpen);
      }}
    >
      <PopoverTrigger
        type="button"
        openOnHover
        delay={120}
        closeDelay={160}
        aria-label={ariaLabel}
        data-testid={dataTestId}
        onClick={() => {
          window.setTimeout(openPopover, 0);
        }}
        onFocus={openPopover}
        onMouseEnter={openPopover}
        onMouseLeave={scheduleClose}
        onPointerLeave={scheduleClose}
        onPointerMove={openPopover}
        className="group inline-flex h-12 min-w-0 items-center gap-2 rounded-full border border-transparent px-2.5 pr-3.5 text-left transition-all outline-none hover:-translate-y-0.5 hover:bg-surface-container-low hover:shadow-token-card focus-visible:ring-3 focus-visible:ring-ring/50 data-open:-translate-y-0.5 data-open:bg-surface-container-low data-open:shadow-token-card"
      >
        <Image
          src={iconSrc}
          alt=""
          width={44}
          height={44}
          className={cn("shrink-0 object-contain", iconClassName)}
          loading="eager"
          unoptimized
          aria-hidden="true"
        />
        <Stat size="heading-lg" className="truncate font-extrabold leading-none text-on-surface">
          {value}
        </Stat>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={12}
        onMouseEnter={openPopover}
        onMouseLeave={scheduleClose}
        onPointerMove={openPopover}
        className="w-[min(calc(100vw-2rem),24rem)] rounded-[1.75rem]"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}

function StreakPopover({
  currentStreak,
  weeklyStats,
  formattedStreak,
}: {
  currentStreak: number;
  weeklyStats: DailyStatEntry[];
  formattedStreak: string;
}) {
  const t = useTranslations("dashboard.home");
  const description =
    currentStreak > 0 ? t("stats.streak_body") : t("stats.streak_zero_body");

  return (
    <div className="overflow-hidden rounded-[1.75rem]">
      <div className="relative bg-[linear-gradient(180deg,var(--color-reward-container)_0%,var(--color-surface-container-lowest)_100%)] p-5">
        <Image
          src={STREAK_ICON_SRC}
          alt=""
          width={108}
          height={108}
          className="absolute right-5 top-5 h-24 w-24 object-contain opacity-20"
          loading="eager"
          unoptimized
          aria-hidden="true"
        />
        <div className="relative max-w-[15rem]">
          <PopoverTitle className="text-3xl font-black leading-tight tracking-normal text-on-surface">
            {t("stats.streak_count", { count: formattedStreak })}
          </PopoverTitle>
          <PopoverDescription className="mt-2 text-base leading-6 text-on-surface-variant">
            {description}
          </PopoverDescription>
        </div>

        <div className="relative mt-5 rounded-[1.35rem] bg-surface-container-lowest/90 p-4 shadow-token-card">
          <p className="type-eyebrow mb-3 text-on-surface-variant">
            {t("stats.weekly_rhythm")}
          </p>
          <div className="grid grid-cols-7 gap-1.5">
            {DAY_KEYS.map((dayKey, index) => {
              const entry = weeklyStats[index];
              const isActive = Boolean(
                entry &&
                  (entry.practice_minutes > 0 ||
                    entry.sessions_completed > 0)
              );

              return (
                <div
                  key={dayKey}
                  className="flex min-w-0 flex-col items-center gap-1.5"
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-xs transition-colors",
                      isActive
                        ? "bg-[#FF9F45] text-white shadow-token-card"
                        : "bg-outline-variant/30 text-on-surface-variant"
                    )}
                  >
                    {isActive ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Zap className="h-4 w-4 opacity-45" />
                    )}
                  </span>
                  <span className="type-caption truncate font-bold text-on-surface-variant">
                    {t(`days_labels.${dayKey}`)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CreditsPopover({
  formattedBalance,
  referralCode,
  onReferralOpen,
}: {
  formattedBalance: string;
  referralCode: string | null;
  onReferralOpen: () => void;
}) {
  const t = useTranslations("dashboard.home");

  return (
    <div className="p-5">
      <div className="flex items-center gap-4">
        <Image
          src={CREDIT_ICON_SRC}
          alt=""
          width={76}
          height={76}
          className="h-16 w-16 shrink-0 object-contain"
          loading="eager"
          unoptimized
          aria-hidden="true"
        />
        <div className="min-w-0">
          <PopoverTitle className="text-2xl font-black tracking-normal text-on-surface">
            {t("stats.credits_title")}
          </PopoverTitle>
          <PopoverDescription className="mt-1 text-base leading-6 text-on-surface-variant">
            {t("stats.credits_balance_line", { count: formattedBalance })}
          </PopoverDescription>
        </div>
      </div>

      <Button
        type="button"
        disabled={!referralCode}
        data-testid="dashboard-stats-get-credits"
        onClick={onReferralOpen}
        className="mt-5 h-11 w-full gap-2 rounded-2xl"
      >
        <Sparkles className="h-4 w-4" />
        {t("stats.how_to_get_credits")}
      </Button>
    </div>
  );
}

export function formatDashboardNumber(value: number) {
  return value.toLocaleString("en-US");
}
