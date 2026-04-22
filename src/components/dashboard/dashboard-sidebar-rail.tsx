"use client";

import { useState } from "react";
import {
  BarChart3,
  BookMarked,
  BookOpen,
  ChevronRight,
  Clock3,
  HelpCircle,
  Home,
  MessageSquareText,
  Mic,
  Scale,
  Settings,
  Sparkles,
  Target,
  Gift,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { LogoMark } from "@/components/landing/logo-mark";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { DashboardGoalSummary, DashboardNavItem } from "@/lib/api/dashboard";

const NAV_ICONS = {
  dashboard: Home,
  speaking: Mic,
  debate: Scale,
  courses: BookOpen,
  coach: Sparkles,
  feedback: MessageSquareText,
  history: Clock3,
  bookmarks: BookMarked,
  analytics: BarChart3,
} as const;

interface DashboardSidebarRailProps {
  navItems: DashboardNavItem[];
  dailyGoal: DashboardGoalSummary;
  referralCode: string | null;
  inviteReward: number;
}

export function DashboardSidebarRail({
  navItems,
  dailyGoal,
  referralCode,
  inviteReward,
}: DashboardSidebarRailProps) {
  const t = useTranslations("dashboard.home");
  const tNav = useTranslations("dashboard.nav");
  const [copied, setCopied] = useState(false);

  return (
    <aside className="sticky top-0 hidden h-screen overflow-hidden border-r border-outline-variant/10 bg-surface-container-lowest px-5 py-6 lg:flex lg:flex-col">
      <LogoMark
        className="shrink-0"
        bubbleClassName="h-11 w-11 rounded-2xl"
        textClassName="text-[1.75rem]"
      />

      <nav className="mt-8 space-y-1.5">
        {navItems.map((item) => {
          const Icon = NAV_ICONS[item.key];
          const isActive = item.key === "dashboard";
          const isDisabled = item.status === "coming-soon";

          if (item.href && !isDisabled) {
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  "group flex items-center justify-between rounded-[1.15rem] px-4 py-3 text-sm font-medium transition-all",
                  isActive
                    ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgba(77,134,247,0.12)]"
                    : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
                )}
              >
                <span className="flex items-center gap-3">
                  <Icon className="h-5 w-5" />
                  {tNav(item.key)}
                </span>
                <span
                  className={cn(
                    "h-6 w-1 rounded-full bg-primary transition-opacity",
                    isActive ? "opacity-100" : "opacity-0 group-hover:opacity-20"
                  )}
                />
              </Link>
            );
          }

          return (
            <div
              key={item.key}
              className="flex items-center justify-between rounded-[1.15rem] px-4 py-3 text-sm text-on-surface-variant"
            >
              <span className="flex items-center gap-3">
                <Icon className="h-5 w-5 opacity-70" />
                {tNav(item.key)}
              </span>
              <span className="rounded-full border border-outline-variant/15 bg-surface-container-low px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]">
                {t("coming_soon")}
              </span>
            </div>
          );
        })}
      </nav>

      <div className="mt-8 space-y-4">
        <div className="rounded-[1.5rem] border border-outline-variant/15 bg-surface-container-lowest p-4 shadow-[0_20px_60px_-48px_rgba(22,39,91,0.45)]">
          <div className="flex items-center gap-2 text-primary">
            <Target className="h-5 w-5" />
            <span className="text-sm font-semibold">{t("today_goal_title")}</span>
          </div>

          <p className="mt-4 text-[1.9rem] font-semibold leading-none text-on-surface">
            {dailyGoal.practicedMinutes} / {dailyGoal.goalMinutes}
            <span className="ml-1 text-sm font-medium text-on-surface-variant">
              {t("min")}
            </span>
          </p>

          <p className="mt-2 text-sm text-on-surface-variant">
            {t("today_goal_subtitle")}
          </p>

          <Progress
            value={dailyGoal.progressPercent}
            className="mt-4 h-2.5 bg-surface-container-high"
          />

          <p className="mt-4 text-sm text-on-surface-variant">
            {dailyGoal.metGoal ? t("goal_complete") : t("goal_keep_going")}
          </p>
        </div>

        <div className="rounded-[1.5rem] border border-outline-variant/15 bg-surface-container-lowest p-4 shadow-[0_20px_60px_-48px_rgba(22,39,91,0.45)]">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Gift className="h-5 w-5" />
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

          <button
            type="button"
            disabled={!referralCode}
            onClick={() => {
              if (!referralCode) return;
              const link = `${window.location.origin}/join/${referralCode}`;
              navigator.clipboard.writeText(link);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1800);
            }}
            className="mt-4 flex w-full items-center justify-between rounded-[1rem] border border-outline-variant/15 bg-surface-container-low px-3 py-2.5 text-sm font-medium text-on-surface transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>{copied ? t("referral_copied") : t("invite_friend_cta")}</span>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="mt-auto space-y-2 pt-6">
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-[1rem] px-3 py-2.5 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
        >
          <Settings className="h-5 w-5" />
          {t("settings_label")}
        </Link>
        <Button
          type="button"
          variant="ghost"
          className="w-full justify-start rounded-[1rem] px-3 py-2.5 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
        >
          <HelpCircle className="mr-3 h-5 w-5" />
          {t("help_support")}
        </Button>
      </div>
    </aside>
  );
}
