"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Mic2,
  BookOpen,
  History,
  Settings,
  LogOut,
  Trophy,
  Target,
  Flame,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types/database";

interface DashboardContentProps {
  user: User;
  profile: Profile | null;
}

export function DashboardContent({ user, profile }: DashboardContentProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  const displayName =
    profile?.display_name ||
    user.user_metadata?.display_name ||
    user.email?.split("@")[0] ||
    "Debater";

  const stats = {
    streak: profile?.streak_current ?? 0,
    sessions: profile?.total_sessions_completed ?? 0,
    xp: profile?.xp ?? 0,
    level: profile?.level ?? 1,
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-outline-variant/10 glass-nav backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/dashboard"
            className="text-xl font-extrabold text-primary tracking-tight"
          >
            DebateLab
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm font-medium text-on-surface-variant sm:block">
              {displayName}
            </span>
            <button
              onClick={handleSignOut}
              className="rounded-lg p-2 text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-on-surface">
            Welcome back, {displayName}!
          </h1>
          <p className="mt-1 text-on-surface-variant">
            Ready to sharpen your debate skills today?
          </p>
        </div>

        {/* Stats */}
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-outline-variant/10 bg-primary-container/30 p-4">
            <Flame className="mb-2 h-5 w-5 text-primary" />
            <p className="text-2xl font-bold text-on-surface">{stats.streak}</p>
            <p className="text-xs text-on-surface-variant">Day Streak</p>
          </div>
          <div className="rounded-xl border border-outline-variant/10 bg-tertiary-container/30 p-4">
            <Target className="mb-2 h-5 w-5 text-tertiary" />
            <p className="text-2xl font-bold text-on-surface">
              {stats.sessions}
            </p>
            <p className="text-xs text-on-surface-variant">Sessions</p>
          </div>
          <div className="rounded-xl border border-outline-variant/10 bg-secondary-container/30 p-4">
            <Trophy className="mb-2 h-5 w-5 text-secondary" />
            <p className="text-2xl font-bold text-on-surface">{stats.xp}</p>
            <p className="text-xs text-on-surface-variant">Total XP</p>
          </div>
          <div className="rounded-xl border border-outline-variant/10 bg-[#fff9e5] p-4">
            <TrendingUp className="mb-2 h-5 w-5 text-[#b28b00]" />
            <p className="text-2xl font-bold text-on-surface">
              Lv. {stats.level}
            </p>
            <p className="text-xs text-on-surface-variant">Level</p>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link href="/practice" className="group">
            <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 transition-all hover:border-primary/30 hover:shadow-lg soft-shadow">
              <Mic2 className="mb-3 h-8 w-8 text-primary" />
              <h3 className="font-semibold text-on-surface">
                Practice Debate
              </h3>
              <p className="mt-1 text-sm text-on-surface-variant">
                Start a solo practice session
              </p>
            </div>
          </Link>
          <Link href="/history" className="group">
            <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 transition-all hover:border-primary/30 hover:shadow-lg soft-shadow">
              <History className="mb-3 h-8 w-8 text-tertiary" />
              <h3 className="font-semibold text-on-surface">History</h3>
              <p className="mt-1 text-sm text-on-surface-variant">
                Review past sessions
              </p>
            </div>
          </Link>
          <div className="opacity-50">
            <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 soft-shadow">
              <BookOpen className="mb-3 h-8 w-8 text-secondary" />
              <h3 className="font-semibold text-on-surface">Courses</h3>
              <p className="mt-1 text-sm text-on-surface-variant">
                Coming soon
              </p>
            </div>
          </div>
          <div className="opacity-50">
            <div className="rounded-2xl border border-outline-variant/10 bg-surface-container-lowest p-6 soft-shadow">
              <Settings className="mb-3 h-8 w-8 text-on-surface-variant" />
              <h3 className="font-semibold text-on-surface">Settings</h3>
              <p className="mt-1 text-sm text-on-surface-variant">
                Coming soon
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
