"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Check, Copy, Gift, Star, TimerReset, Trophy } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { OrbBalance } from "@/components/shared/orb-balance";
import { StreakCard } from "./streak-card";
import { DashboardFocusPanel } from "./dashboard-focus-panel";
import { RecentPracticePanel } from "./recent-practice-panel";
import { cn } from "@/lib/utils";
import type { DashboardData } from "@/lib/api/dashboard";

function getTimeGreetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "greeting_morning";
  if (hour < 17) return "greeting_afternoon";
  return "greeting_evening";
}

interface DashboardContentProps {
  data: DashboardData;
  displayName: string;
}

interface HeaderStatProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  accentClassName?: string;
}

function HeaderStat({
  icon,
  label,
  value,
  accentClassName,
}: HeaderStatProps) {
  return (
    <div className="inline-flex items-center gap-3 rounded-2xl border border-outline-variant/15 bg-surface-container-lowest px-3.5 py-2.5 soft-shadow">
      <div
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary",
          accentClassName
        )}
      >
        {icon}
      </div>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-on-surface-variant">
          {label}
        </p>
        <p className="text-sm font-semibold text-on-surface">{value}</p>
      </div>
    </div>
  );
}

export function DashboardContent({ data, displayName }: DashboardContentProps) {
  const t = useTranslations("dashboard.home");
  const [copied, setCopied] = useState(false);
  const { profile, weeklyStats } = data;

  const isAdmin = profile?.role === "admin";
  const streak = profile?.streak_current ?? 0;
  const longestStreak = profile?.streak_longest ?? 0;
  const totalSessions = profile?.total_sessions_completed ?? 0;
  const xp = profile?.xp ?? 0;
  const level = profile?.level ?? 1;
  const xpInLevel = xp % 500;
  const xpToNext = 500;
  const orbBalance = profile?.orb_balance ?? 0;

  const weekMinutes = weeklyStats.reduce((s, d) => s + d.practice_minutes, 0);
  const weekSessions = weeklyStats.reduce(
    (s, d) => s + d.sessions_completed,
    0
  );
  const activeDays = weeklyStats.filter(
    (entry) => entry.practice_minutes > 0 || entry.sessions_completed > 0
  ).length;

  const motivations = t.raw("motivations") as string[];
  const motivationIndex =
    motivations.length > 0
      ? (displayName.length + streak + level + totalSessions) %
        motivations.length
      : 0;
  const motivation = motivations[motivationIndex] ?? "";

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold text-on-surface sm:text-3xl">
            {t(getTimeGreetingKey())}, {displayName}!
          </h1>
          <p className="mt-1 max-w-2xl text-on-surface-variant">{motivation}</p>

          <div className="mt-4 flex flex-wrap gap-3">
            <HeaderStat
              icon={<TimerReset className="h-4 w-4" />}
              label={t("week_activity")}
              value={`${activeDays}/7`}
              accentClassName="bg-primary/10 text-primary"
            />
            <HeaderStat
              icon={<Trophy className="h-4 w-4" />}
              label={t("sessions_completed")}
              value={weekSessions}
              accentClassName="bg-secondary-container/40 text-secondary"
            />
            <HeaderStat
              icon={<Star className="h-4 w-4" />}
              label={t("minutes_practiced")}
              value={
                <>
                  {weekMinutes}
                  <span className="ml-1 text-xs font-medium text-on-surface-variant">
                    {t("min")}
                  </span>
                </>
              }
              accentClassName="bg-[#fff9e5] text-[#b28b00]"
            />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:w-[430px]">
          <section className="rounded-[1.75rem] border border-outline-variant/15 bg-surface-container-lowest p-4 soft-shadow">
            <div className="mb-3 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#fff9e5]">
                <Star className="h-5 w-5 text-[#b28b00]" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                  {t("focus_level_label")}
                </p>
                <p className="text-lg font-semibold text-on-surface">
                  {t("level", { level })}
                </p>
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between text-xs text-on-surface-variant">
                <span>{xpInLevel} XP</span>
                <span>{xpToNext} XP</span>
              </div>
              <Progress
                value={(xpInLevel / xpToNext) * 100}
                className="h-2 bg-[#fff9e5]"
              />
            </div>
          </section>

          <section className="rounded-[1.75rem] border border-outline-variant/15 bg-surface-container-lowest p-4 soft-shadow">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10">
                  <Gift className="h-5 w-5 text-amber-500" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-on-surface-variant">
                    {t("focus_orbs_label")}
                  </p>
                  <OrbBalance balance={orbBalance} size="md" showLabel />
                </div>
              </div>

              {profile?.referral_code ? (
                <button
                  onClick={() => {
                    const link = `${window.location.origin}/join/${profile.referral_code}`;
                    navigator.clipboard.writeText(link);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/25 bg-surface-container-low px-3 py-2 text-xs font-medium text-on-surface transition-colors hover:bg-surface-container"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                      {t("referral_copied")}
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      {t("referral_copy_short")}
                    </>
                  )}
                </button>
              ) : null}
            </div>

            <p className="text-sm text-on-surface-variant">
              {profile?.referral_code
                ? t("referral_subtitle")
                : t("focus_orbs_subtitle")}
            </p>
          </section>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)] xl:items-start">
        <div className="grid min-w-0 gap-5">
          <StreakCard
            streak={streak}
            longestStreak={longestStreak}
            weeklyStats={weeklyStats}
            compact
          />
          <RecentPracticePanel recentSessions={data.recentSessions} />
        </div>

        <div className="min-w-0">
          <DashboardFocusPanel
            enrollments={data.enrollments}
            isAdmin={isAdmin}
          />
        </div>
      </div>
    </div>
  );
}
