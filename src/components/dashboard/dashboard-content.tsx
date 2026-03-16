"use client";

import Link from "next/link";
import {
  Flame,
  Clock,
  Trophy,
  Star,
  Mic2,
  BookOpen,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { WeeklyChart } from "./weekly-chart";
import { AiCoachWidget } from "./ai-coach-widget";
import { cn } from "@/lib/utils";
import type { DashboardData } from "@/lib/api/dashboard";

const GREETINGS = [
  "Ready to sharpen your arguments?",
  "Let's make today count!",
  "Your debate skills are growing!",
  "Time to level up your rhetoric!",
  "Another day, another argument won!",
];

function getTimeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function getMotivation(): string {
  return GREETINGS[Math.floor(Math.random() * GREETINGS.length)];
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

interface DashboardContentProps {
  data: DashboardData;
  displayName: string;
}

export function DashboardContent({ data, displayName }: DashboardContentProps) {
  const { profile, enrollments, recentSessions, weeklyStats } = data;

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

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 lg:py-8">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-on-surface sm:text-3xl">
          {getTimeGreeting()}, {displayName}!
        </h1>
        <p className="mt-1 text-on-surface-variant">{getMotivation()}</p>
      </div>

      {/* Stats Row */}
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {/* Streak */}
        <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5 soft-shadow">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary-container/40">
            <Flame className="h-5 w-5 text-primary" />
          </div>
          <p className="text-2xl font-bold text-on-surface">
            {streak} <span className="text-sm font-medium text-on-surface-variant">days</span>
          </p>
          <p className="text-xs text-on-surface-variant">
            Longest: {longestStreak}
          </p>
        </div>

        {/* Study Hours */}
        <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5 soft-shadow">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-tertiary-container/40">
            <Clock className="h-5 w-5 text-tertiary" />
          </div>
          <p className="text-2xl font-bold text-on-surface">
            {totalMinutes}<span className="text-sm font-medium text-on-surface-variant">min</span>
          </p>
          <p className="text-xs text-on-surface-variant">
            +{weekMinutes}min this week
          </p>
        </div>

        {/* Sessions */}
        <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5 soft-shadow">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-secondary-container/40">
            <Trophy className="h-5 w-5 text-secondary" />
          </div>
          <p className="text-2xl font-bold text-on-surface">{totalSessions}</p>
          <p className="text-xs text-on-surface-variant">
            +{weekSessions} this week
          </p>
        </div>

        {/* Level & XP */}
        <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-5 soft-shadow">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff9e5]">
            <Star className="h-5 w-5 text-[#b28b00]" />
          </div>
          <p className="text-2xl font-bold text-on-surface">Level {level}</p>
          <div className="mt-1.5">
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

      {/* Weekly Activity Chart */}
      <div className="mb-8">
        <WeeklyChart stats={weeklyStats} />
      </div>

      {/* Two column grid */}
      <div className="mb-8 grid gap-6 lg:grid-cols-2">
        {/* Continue Learning */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-on-surface">
              Continue Learning
            </h2>
            {enrollments.length > 0 && (
              <Link
                href="/courses"
                className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                See all <ArrowRight className="h-3 w-3" />
              </Link>
            )}
          </div>

          {enrollments.length === 0 ? (
            <Link href="/courses">
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant/30 bg-surface-container-lowest p-8 text-center transition-colors hover:border-primary/30 hover:bg-primary-container/5">
                <BookOpen className="mb-3 h-8 w-8 text-primary/40" />
                <p className="font-medium text-on-surface">
                  Start your first course!
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Explore structured debate lessons
                </p>
              </div>
            </Link>
          ) : (
            <div className="space-y-3">
              {enrollments.map((e) => (
                <Link
                  key={e.id}
                  href={`/courses/${e.course_id}`}
                  className="flex items-center gap-4 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-4 transition-all hover:border-primary/20 soft-shadow"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-container/30">
                    <BookOpen className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-on-surface">
                      {e.course_title}
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      <Progress
                        value={e.progress_percent}
                        className="h-1.5 flex-1"
                      />
                      <span className="text-xs font-medium text-on-surface-variant">
                        {e.progress_percent}%
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0 bg-primary text-on-primary"
                  >
                    Continue
                  </Button>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recent Practice */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-on-surface">
              Recent Practice
            </h2>
            <Link
              href="/history"
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          {recentSessions.length === 0 ? (
            <Link href="/practice">
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-outline-variant/30 bg-surface-container-lowest p-8 text-center transition-colors hover:border-primary/30 hover:bg-primary-container/5">
                <Mic2 className="mb-3 h-8 w-8 text-primary/40" />
                <p className="font-medium text-on-surface">
                  Complete your first debate!
                </p>
                <p className="mt-1 text-xs text-on-surface-variant">
                  Practice and get AI-powered feedback
                </p>
              </div>
            </Link>
          ) : (
            <div className="space-y-3">
              {recentSessions.map((s) => (
                <Link
                  key={s.id}
                  href={`/history/${s.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-4 transition-all hover:border-primary/20 soft-shadow"
                >
                  {/* Score */}
                  <div
                    className={cn(
                      "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                      s.total_score != null && s.total_score >= 75
                        ? "bg-emerald-500/10 text-emerald-600"
                        : s.total_score != null && s.total_score >= 40
                          ? "bg-amber-500/10 text-amber-600"
                          : s.total_score != null
                            ? "bg-red-500/10 text-red-500"
                            : "bg-surface-container-high text-on-surface-variant"
                    )}
                  >
                    {s.total_score ?? "—"}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-on-surface">
                      {s.topic_title}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] px-1.5 py-0",
                          s.side === "proposition"
                            ? "border-emerald-500/30 text-emerald-600"
                            : "border-rose-500/30 text-rose-500"
                        )}
                      >
                        {s.side === "proposition" ? "FOR" : "AGAINST"}
                      </Badge>
                      {s.overall_band && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0"
                        >
                          {s.overall_band}
                        </Badge>
                      )}
                      <span className="text-[10px] text-on-surface-variant">
                        {formatDate(s.created_at)}
                      </span>
                    </div>
                  </div>
                </Link>
              ))}

              <Link href="/practice">
                <Button
                  variant="outline"
                  className="mt-2 w-full gap-2 border-outline-variant/20 text-on-surface-variant hover:text-primary"
                >
                  <Sparkles className="h-4 w-4" />
                  Start New Practice
                </Button>
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* AI Coach Widget */}
      <div className="mb-8">
        <AiCoachWidget />
      </div>
    </div>
  );
}
