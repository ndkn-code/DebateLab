"use client";

import { useState, type ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  Clock,
  Trophy,
  Star,
  ArrowRight,
  Gift,
  Copy,
  Check,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { WeeklyChart } from "./weekly-chart";
import { AiCoachWidget } from "./ai-coach-widget";
import { ContinueLearningCard } from "./continue-learning-card";
import { PracticeLaunchpad } from "./practice-launchpad";
import { StreakCard } from "./streak-card";
import { cn } from "@/lib/utils";
import { LottieAnimation } from "@/components/ui/lottie-animation";
import emptyAnimation from "../../../public/lottie/empty-search.json";
import { OrbBalance } from "@/components/shared/orb-balance";
import type { DashboardData } from "@/lib/api/dashboard";

function getTimeGreetingKey(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "greeting_morning";
  if (hour < 17) return "greeting_afternoon";
  return "greeting_evening";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function formatDuration(seconds: number, minutesLabel: string) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes} ${minutesLabel}`;
}

interface DashboardContentProps {
  data: DashboardData;
  displayName: string;
}

interface MetricCardProps {
  icon: ReactNode;
  accentClassName: string;
  value: ReactNode;
  caption: string;
  footer?: string;
}

function MetricCard({
  icon,
  accentClassName,
  value,
  caption,
  footer,
}: MetricCardProps) {
  return (
    <div className="rounded-[1.75rem] border border-outline-variant/15 bg-surface-container-lowest p-5 soft-shadow">
      <div
        className={cn(
          "mb-4 flex h-11 w-11 items-center justify-center rounded-2xl",
          accentClassName
        )}
      >
        {icon}
      </div>
      <p className="text-2xl font-bold text-on-surface">{value}</p>
      <p className="mt-1 text-sm font-medium text-on-surface-variant">
        {caption}
      </p>
      {footer ? (
        <p className="mt-3 text-xs text-on-surface-variant">{footer}</p>
      ) : null}
    </div>
  );
}

export function DashboardContent({ data, displayName }: DashboardContentProps) {
  const t = useTranslations("dashboard.home");
  const tHistory = useTranslations("dashboard.history");
  const [copied, setCopied] = useState(false);
  const { profile, recentSessions, weeklyStats } = data;

  const isAdmin = profile?.role === "admin";
  const streak = profile?.streak_current ?? 0;
  const longestStreak = profile?.streak_longest ?? 0;
  const totalMinutes = profile?.total_practice_minutes ?? 0;
  const totalSessions = profile?.total_sessions_completed ?? 0;
  const xp = profile?.xp ?? 0;
  const level = profile?.level ?? 1;
  const xpInLevel = xp % 500;
  const xpToNext = 500;

  // Weekly stats aggregation
  const weekMinutes = weeklyStats.reduce((s, d) => s + d.practice_minutes, 0);
  const weekSessions = weeklyStats.reduce(
    (s, d) => s + d.sessions_completed,
    0
  );

  // Keep the greeting stable for a given user/session instead of choosing a new
  // line on every render.
  const motivations = t.raw('motivations') as string[];
  const motivationIndex =
    motivations.length > 0
      ? (displayName.length + streak + level + totalSessions) % motivations.length
      : 0;
  const motivation = motivations[motivationIndex] ?? "";
  const showCoursePanel = isAdmin || data.enrollments.length > 0;

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-on-surface sm:text-3xl">
          {t(getTimeGreetingKey())}, {displayName}!
        </h1>
        <p className="mt-1 text-on-surface-variant">{motivation}</p>
      </div>

      {/* Hero Dashboard Cards */}
      <div className="mb-8 grid gap-4 xl:grid-cols-[1.35fr_0.95fr] xl:items-start">
        <StreakCard
          streak={streak}
          longestStreak={longestStreak}
          weeklyStats={weeklyStats}
        />

        <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
          <MetricCard
            icon={<Clock className="h-5 w-5 text-tertiary" />}
            accentClassName="bg-tertiary-container/40"
            value={
              <>
                {totalMinutes}
                <span className="ml-1 text-sm font-medium text-on-surface-variant">
                  {t('min')}
                </span>
              </>
            }
            caption={t('minutes_practiced')}
            footer={t('this_week_min', { count: weekMinutes })}
          />

          <MetricCard
            icon={<Trophy className="h-5 w-5 text-secondary" />}
            accentClassName="bg-secondary-container/40"
            value={totalSessions}
            caption={t('sessions_completed')}
            footer={t('this_week_sessions', { count: weekSessions })}
          />

          <div className="rounded-[1.75rem] border border-outline-variant/15 bg-surface-container-lowest p-5 soft-shadow">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff9e5]">
              <Star className="h-5 w-5 text-[#b28b00]" />
            </div>
            <p className="text-2xl font-bold text-on-surface">
              {t('level', { level })}
            </p>
            <p className="mt-1 text-sm font-medium text-on-surface-variant">
              {t('xp_progress')}
            </p>
            <div className="mt-4">
              <div className="mb-1 flex justify-between text-[10px] text-on-surface-variant">
                <span>{xpInLevel} XP</span>
                <span>{xpToNext} XP</span>
              </div>
              <Progress
                value={(xpInLevel / xpToNext) * 100}
                className="h-1.5 bg-[#fff9e5]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Primary actions */}
      <div className="mb-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr] xl:items-start">
        <PracticeLaunchpad />
        <AiCoachWidget />
      </div>

      {/* Progress and support */}
      <div
        className={cn(
          "mb-8 grid gap-6",
          showCoursePanel ? "xl:grid-cols-[0.9fr_1.1fr]" : ""
        )}
      >
        <WeeklyChart stats={weeklyStats} />

        {showCoursePanel && (
          <ContinueLearningCard
            enrollments={data.enrollments}
            isAdmin={isAdmin}
          />
        )}
      </div>

      {/* Recent Practice */}
      <div className="mb-8">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-on-surface">
              {t("recent_practice")}
            </h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              {t("recent_practice_subtitle")}
            </p>
          </div>
          <Link
            href="/history"
            className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {t("view_all")} <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        {recentSessions.length === 0 ? (
          <Link href="/practice">
            <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant/30 bg-surface-container-lowest p-8 text-center transition-colors hover:border-primary/30 hover:bg-primary-container/5">
              <LottieAnimation animationData={emptyAnimation} className="mb-2 h-24 w-24" />
              <p className="font-medium text-on-surface">
                {t("first_debate")}
              </p>
              <p className="mt-1 text-xs text-on-surface-variant">
                {t("practice_get_feedback")}
              </p>
            </div>
          </Link>
        ) : (
          <div className="grid gap-3 lg:grid-cols-3">
            {recentSessions.map((session) => (
              <Link
                key={session.id}
                href={`/history/${session.id}`}
                className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-4 transition-all hover:border-primary/20 soft-shadow"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={cn(
                      "flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                      session.total_score != null && session.total_score >= 75
                        ? "bg-emerald-500/10 text-emerald-600"
                        : session.total_score != null && session.total_score >= 40
                          ? "bg-amber-500/10 text-amber-600"
                          : session.total_score != null
                            ? "bg-red-500/10 text-red-500"
                            : "bg-surface-container-high text-on-surface-variant"
                    )}
                  >
                    {session.total_score ?? "—"}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-on-surface">
                      {session.topic_title}
                    </p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {session.practice_track === "speaking"
                          ? tHistory("speaking")
                          : tHistory("debate")}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {session.practice_track === "speaking"
                          ? tHistory("single_speech")
                          : session.mode === "full"
                            ? tHistory("full")
                            : tHistory("quick")}
                      </Badge>
                      {session.practice_track === "debate" ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] px-1.5 py-0",
                            session.side === "proposition"
                              ? "border-emerald-500/30 text-emerald-600"
                              : "border-rose-500/30 text-rose-500"
                          )}
                        >
                          {session.side === "proposition"
                            ? t("for")
                            : t("against")}
                        </Badge>
                      ) : null}
                      {session.overall_band ? (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {session.overall_band}
                        </Badge>
                      ) : null}
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[11px] text-on-surface-variant">
                      <span>{formatDate(session.created_at)}</span>
                      <span>{formatDuration(session.duration_seconds, t("min"))}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Orb Balance & Referral Card */}
      {profile?.referral_code && (
        <div className="flex flex-col gap-4 rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/5 via-orange-500/5 to-amber-500/5 p-4 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/10">
              <Gift className="h-5 w-5 text-amber-500" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <OrbBalance balance={profile.orb_balance ?? 0} size="md" showLabel />
                <span className="text-xs text-on-surface-variant">
                  {t("referral_remaining")}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-on-surface-variant">
                {t("referral_subtitle")}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              const link = `${window.location.origin}/join/${profile.referral_code}`;
              navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-surface-container-lowest px-4 py-2 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container-low"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-emerald-500" />
                {t("referral_copied")}
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                {t("referral_copy")}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
