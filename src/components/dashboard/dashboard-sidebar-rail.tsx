"use client";

import { useState } from "react";
import {
  BookOpen,
  ChartColumnBig,
  ChevronRight,
  Clock3,
  HelpCircle,
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
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DashboardNavItem } from "@/lib/api/dashboard";

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
}

export function DashboardSidebarRail({
  navItems,
  referralCode,
  inviteReward,
  isAdmin,
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
    <aside className="hidden h-full w-55 shrink-0 overflow-hidden border-r border-outline-variant/15 bg-surface-container-lowest lg:flex lg:flex-col">
      <div className="flex h-14 shrink-0 items-center border-b border-outline-variant/10 px-4">
        <LogoMark
          className="shrink-0"
          bubbleClassName="h-9 w-9 rounded-xl"
          textClassName="text-[1.45rem]"
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
                <span className="ml-2 inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-container px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-on-surface-variant">
                  <Lock className="h-3 w-3" />
                  {t("coming_soon")}
                </span>
              ) : (
                <span
                  className={cn(
                    "h-6 w-1 rounded-full bg-primary transition-opacity",
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
                className="flex h-8 cursor-not-allowed items-center justify-between rounded-lg px-2 text-sm font-medium text-on-surface-variant/65 opacity-75"
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
                  ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgba(77,134,247,0.14)]"
                  : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
              )}
            >
              {content}
            </Link>
          );
        })}
      </nav>

      <div className="shrink-0 border-t border-outline-variant/10 p-2">
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
            className="flex h-8 w-full items-center justify-between rounded-lg px-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="flex min-w-0 items-center gap-3">
              <Gift className="h-5 w-5 shrink-0 text-primary" />
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
              className="flex h-8 items-center gap-3 rounded-lg bg-primary/10 px-2 text-sm font-semibold text-primary shadow-[inset_0_0_0_1px_rgba(77,134,247,0.14)] transition-colors hover:bg-primary/15"
            >
              <Shield className="h-5 w-5 shrink-0" />
              <span>{tNav("adminShort")}</span>
            </Link>
          ) : null}
          <Link
            href="/settings"
            className="flex h-8 items-center gap-3 rounded-lg px-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-surface-container-low hover:text-on-surface"
          >
            <Settings className="h-5 w-5 shrink-0" />
            <span className="truncate">{t("settings_label")}</span>
          </Link>
          <Button
            type="button"
            variant="ghost"
            className="h-8 w-full justify-start rounded-lg px-2 text-sm font-medium text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
          >
            <HelpCircle className="mr-3 h-5 w-5 shrink-0" />
            <span className="truncate">{t("help_support")}</span>
          </Button>
        </div>
      </div>
    </aside>
  );
}
