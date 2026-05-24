"use client";

import { useState } from "react";
import {
  BookOpen,
  ChartColumnBig,
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
} from "@/components/ui/icons";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { LogoMark } from "@/components/landing/logo-mark";
import { DebateModeSwitcher } from "@/components/shared/debate-mode-switcher";
import { cn } from "@/lib/utils";
import type { DashboardNavItem } from "@/lib/api/dashboard";
import { SupportIssueDialog } from "@/components/support/support-issue-dialog";
import type { Profile } from "@/types/database";
import type { AppLocale } from "@/lib/locale-switch";

const NAV_ICONS = {
  dashboard: Home,
  practice: Scale,
  duel: Swords,
  courses: BookOpen,
  coach: Sparkles,
  history: Clock3,
  analytics: ChartColumnBig,
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
    <aside className="hidden h-full w-55 shrink-0 overflow-hidden border-r border-sidebar-muted/15 bg-sidebar text-sidebar-foreground md:flex md:flex-col">
      <div className="flex h-14 shrink-0 items-center border-b border-sidebar-muted/15 px-4">
        <LogoMark
          size="sm"
          variant="dark"
        />
      </div>

      <div className="px-2 pt-3">
        <DebateModeSwitcher
          variant="sidebar"
          currentLocale={currentLocale}
        />
      </div>

      <nav className="scrollbar-hide flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-2 py-3">
        {navItems.map((item) => {
          const Icon = NAV_ICONS[item.key];
          const href = item.href;
          const isUnavailable = item.status === "coming-soon" || !href;
          const isActive = isActiveItem(item);

          const content = (
            <>
              <span className="flex min-w-0 items-center gap-3">
                <Icon className="h-5 w-5 shrink-0" />
                <span className="truncate">{tNav(item.key)}</span>
              </span>
              {isUnavailable ? (
                <span className="ml-2 inline-flex shrink-0 items-center gap-1 rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted/75">
                  <Lock className="h-3 w-3" />
                  {t("coming_soon")}
                </span>
              ) : (
                <span
                  className={cn(
                    "h-6 w-1 rounded-full bg-sidebar-muted transition-opacity",
                    isActive ? "opacity-100" : "opacity-0 group-hover:opacity-20"
                  )}
                />
              )}
            </>
          );

          if (isUnavailable) {
            return (
              <div
                key={item.key}
                aria-disabled="true"
                className="flex h-8 cursor-not-allowed items-center justify-between rounded-lg px-2 text-sm font-medium text-sidebar-muted/50 opacity-75"
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
                isActive
                  ? "bg-white/[0.12] text-sidebar-foreground shadow-[inset_0_0_0_1px_rgba(169,198,251,0.16)]"
                  : "text-sidebar-muted/85 hover:bg-white/[0.08] hover:text-sidebar-foreground"
              )}
            >
              {content}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-sidebar-muted/15 p-2">
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
            className="flex h-8 w-full items-center justify-between rounded-lg px-2 text-sm font-medium text-sidebar-muted/85 transition-colors hover:bg-white/[0.08] hover:text-sidebar-foreground disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="flex min-w-0 items-center gap-3">
              <Gift className="h-5 w-5 shrink-0 text-sidebar-muted" />
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
              className="flex h-8 items-center gap-3 rounded-lg bg-white/[0.12] px-2 text-sm font-semibold text-sidebar-foreground shadow-[inset_0_0_0_1px_rgba(169,198,251,0.16)] transition-colors hover:bg-white/[0.16]"
            >
              <Shield className="h-5 w-5 shrink-0" />
              <span>{tNav("adminShort")}</span>
            </Link>
          ) : null}
          <Link
            href="/settings"
            className="flex h-8 items-center gap-3 rounded-lg px-2 text-sm font-medium text-sidebar-muted/85 transition-colors hover:bg-white/[0.08] hover:text-sidebar-foreground"
          >
            <Settings className="h-5 w-5 shrink-0" />
            <span className="truncate">{t("settings_label")}</span>
          </Link>
          <SupportIssueDialog
            profile={profile}
            userEmail={userEmail}
            triggerClassName="text-sidebar-muted/85 hover:bg-white/[0.08] hover:text-sidebar-foreground"
          />
        </div>
      </div>
    </aside>
  );
}
