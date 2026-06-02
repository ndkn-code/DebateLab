"use client";

import { useState } from "react";
import {
  BookOpen,
  ChevronRight,
  Clock3,
  Home,
  Lock,
  Scale,
  Settings,
  Shield,
  Sparkles,
  Gift,
  Swords,
  Trophy,
  UserRound,
} from "@/components/ui/icons";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { LogoMark } from "@/components/landing/logo-mark";
import { DebateModeSwitcher } from "@/components/shared/debate-mode-switcher";
import { cn } from "@/lib/utils";
import type { DashboardNavItem } from "@/lib/api/dashboard";
import { SupportIssueDialog } from "@/components/support/support-issue-dialog";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import type { Profile } from "@/types/database";
import type { AppLocale } from "@/lib/locale-switch";

const NAV_ICONS = {
  dashboard: Home,
  practice: Scale,
  leaderboards: Trophy,
  duel: Swords,
  courses: BookOpen,
  coach: Sparkles,
  history: Clock3,
  analytics: UserRound,
} as const;

interface DashboardSidebarRailProps {
  navItems: DashboardNavItem[];
  referralCode: string | null;
  inviteReward: number;
  isAdmin: boolean;
  profile: Profile | null;
  userEmail: string | null;
  currentLocale: AppLocale;
}

export function DashboardSidebarRail({
  navItems,
  referralCode,
  inviteReward,
  isAdmin,
  profile,
  userEmail,
  currentLocale,
}: DashboardSidebarRailProps) {
  const t = useTranslations("dashboard.home");
  const tNav = useTranslations("dashboard.nav");
  const [copied, setCopied] = useState(false);
  const pathname = usePathname();
  const isProfileSurface = pathname.startsWith("/profile");

  const isActiveItem = (item: DashboardNavItem) => {
    if (!item.href || item.status === "coming-soon") {
      return false;
    }

    if (item.key === "dashboard") {
      return pathname === "/dashboard";
    }

    if (item.key === "practice") {
      return pathname.startsWith("/practice");
    }

    if (item.key === "duel") {
      return pathname.startsWith("/debates");
    }

    if (item.key === "leaderboards") {
      return pathname.startsWith("/leaderboards");
    }

    if (item.key === "courses") {
      return pathname.startsWith("/courses") || pathname.startsWith("/dashboard/courses");
    }

    if (item.key === "coach") {
      return pathname.startsWith("/chat");
    }

    if (item.key === "history") {
      return pathname.startsWith("/history");
    }

    if (item.key === "analytics") {
      return pathname.startsWith("/profile");
    }

    return pathname === item.href;
  };

  return (
    <>
      <div aria-hidden="true" className="hidden h-dvh w-55 shrink-0 md:block" />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden h-dvh w-55 shrink-0 overflow-hidden overscroll-none border-r md:flex md:flex-col",
          isProfileSurface
            ? "border-[#DEE8F8] bg-white text-[#0B1424]"
            : "border-sidebar-muted/15 bg-sidebar text-sidebar-foreground"
        )}
      >
      <div className="flex h-14 shrink-0 items-center px-4">
        <LogoMark
          size="sm"
          variant={isProfileSurface ? "light" : "dark"}
        />
      </div>

      <div className={cn("px-2 pt-3", isProfileSurface && "hidden")}>
        <DebateModeSwitcher
          variant="sidebar"
          currentLocale={currentLocale}
        />
      </div>

      <nav className="scrollbar-hide flex min-h-0 flex-1 flex-col gap-1 overflow-hidden overscroll-none px-2 py-3">
        {navItems.map((item) => {
          const Icon = NAV_ICONS[item.key];
          const href = item.href;
          const isUnavailable = item.status === "coming-soon" || !href;
          const isActive = isActiveItem(item);
          const label = item.key === "analytics" ? tNav("profile") : tNav(item.key);

          const content = (
            <>
              <span className="flex min-w-0 items-center gap-3">
                <Icon className="h-5 w-5 shrink-0" />
                <span className="truncate">{label}</span>
              </span>
              {isUnavailable ? (
                <span
                  className={cn(
                    "ml-2 inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]",
                    isProfileSurface
                      ? "bg-[#F1F6FD] text-[#8A96A8]"
                      : "bg-white/[0.08] text-sidebar-muted/75"
                  )}
                >
                  <Lock className="h-3 w-3" />
                  {t("coming_soon")}
                </span>
              ) : null}
            </>
          );

          if (isUnavailable) {
            return (
              <div
                key={item.key}
                aria-disabled="true"
                className={cn(
                  "flex h-8 cursor-not-allowed items-center justify-between rounded-lg px-2 text-sm font-medium opacity-75",
                  isProfileSurface ? "text-[#8A96A8]" : "text-sidebar-muted/50"
                )}
              >
                {content}
              </div>
            );
          }

          return (
            <Link
              key={item.key}
              href={href}
              className={cn(
                "group flex h-8 items-center justify-between rounded-lg px-2 text-sm font-medium transition-all",
                isProfileSurface
                  ? isActive
                    ? "bg-[#EAF1FF] text-[#3E78EC]"
                    : "text-[#415069] hover:bg-[#F1F6FD] hover:text-[#0B1424]"
                  : isActive
                    ? "bg-white/[0.12] text-sidebar-foreground shadow-[inset_0_0_0_1px_rgba(169,198,251,0.16)]"
                    : "text-sidebar-muted/85 hover:bg-white/[0.08] hover:text-sidebar-foreground"
              )}
            >
              {content}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 p-2">
        <div className="space-y-1">
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
            className={cn(
              "flex h-8 w-full items-center justify-between rounded-lg px-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
              isProfileSurface
                ? "text-[#415069] hover:bg-[#F1F6FD] hover:text-[#0B1424]"
                : "text-sidebar-muted/85 hover:bg-white/[0.08] hover:text-sidebar-foreground"
            )}
          >
            <span className="flex min-w-0 items-center gap-3">
              <Gift
                className={cn(
                  "h-5 w-5 shrink-0",
                  isProfileSurface ? "text-[#718096]" : "text-sidebar-muted"
                )}
              />
              <span className="truncate">
                {copied
                  ? t("referral_copied")
                  : t("invite_friend_reward", { count: inviteReward })}
              </span>
            </span>
            <ChevronRight className="h-4 w-4" />
          </button>
          {isAdmin ? (
            <Link
              href="/dashboard/admin"
              className={cn(
                "flex h-8 items-center gap-3 rounded-lg px-2 text-sm font-semibold transition-colors",
                isProfileSurface
                  ? "bg-[#F1F6FD] text-[#0B1424] hover:bg-[#EAF1FF]"
                  : "bg-white/[0.12] text-sidebar-foreground shadow-[inset_0_0_0_1px_rgba(169,198,251,0.16)] hover:bg-white/[0.16]"
              )}
            >
              <Shield className="h-5 w-5 shrink-0" />
              <span>{tNav("adminShort")}</span>
            </Link>
          ) : null}
          <ThemeToggle
            className={
              isProfileSurface
                ? "text-[#415069] hover:bg-[#F1F6FD] hover:text-[#0B1424]"
                : undefined
            }
          />
          <Link
            href="/settings"
            className={cn(
              "flex h-8 items-center gap-3 rounded-lg px-2 text-sm font-medium transition-colors",
              isProfileSurface
                ? "text-[#415069] hover:bg-[#F1F6FD] hover:text-[#0B1424]"
                : "text-sidebar-muted/85 hover:bg-white/[0.08] hover:text-sidebar-foreground"
            )}
          >
            <Settings className="h-5 w-5 shrink-0" />
            <span className="truncate">{t("settings_label")}</span>
          </Link>
          <SupportIssueDialog
            profile={profile}
            userEmail={userEmail}
            triggerClassName={
              isProfileSurface
                ? "text-[#415069] hover:bg-[#F1F6FD] hover:text-[#0B1424]"
                : "text-sidebar-muted/85 hover:bg-white/[0.08] hover:text-sidebar-foreground"
            }
          />
        </div>
      </div>
      </aside>
    </>
  );
}
