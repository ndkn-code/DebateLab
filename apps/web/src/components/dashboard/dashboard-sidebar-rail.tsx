"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import {
  BookOpen,
  BookOpenText,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Clock3,
  Compass,
  GraduationCap,
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
import { ProductIcon } from "@/components/ui/product-icon";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { LogoMark } from "@/components/landing/logo-mark";
import { ModeSwitcher } from "@/components/shared/mode-switcher";
import { cn } from "@/lib/utils";
import { IELTS_ENABLED } from "@/lib/features";
import type { DashboardNavItem } from "@/lib/api/dashboard";
import { SupportIssueDialog } from "@/components/support/support-issue-dialog";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { ReferralCreditsDialog } from "@/components/shared/referral-credits-dialog";
import type { Profile } from "@/types/database";
import type { AppLocale } from "@/lib/locale-switch";
import type { Subject } from "@/lib/subject";
import { NotificationCenter } from "@/components/notifications/notification-center";
import type {
  NotificationInboxSnapshot,
  NotificationUiOperations,
} from "@/components/notifications/contracts";

export type DashboardSidebarNavItem = Omit<DashboardNavItem, "key"> & {
  key: DashboardNavItem["key"] | "ielts_speaking" | "ielts_classes";
};

function SpeakingRehearsalIcon({ className }: { className?: string }) {
  return <ProductIcon name="micStage" weight="duotone" className={className} />;
}

const NAV_ICONS = {
  dashboard: Home,
  practice: Scale,
  leaderboards: Trophy,
  duel: Swords,
  courses: BookOpen,
  coach: Sparkles,
  history: Clock3,
  analytics: UserRound,
  ielts_home: GraduationCap,
  ielts_learn: Compass,
  ielts_speaking: SpeakingRehearsalIcon,
  ielts_library: BookOpen,
  ielts_assigned: ClipboardList,
  ielts_classes: CalendarDays,
  resources: BookOpenText,
} as const;

interface DashboardSidebarRailProps {
  navItems: DashboardSidebarNavItem[];
  referralCode: string | null;
  inviteReward: number;
  isAdmin: boolean;
  profile: Profile | null;
  userEmail: string | null;
  currentLocale: AppLocale;
  activeSubject: Subject;
  notificationInbox?: NotificationInboxSnapshot;
  notificationOperations?: Pick<
    NotificationUiOperations,
    "listInbox" | "markRead" | "markAllRead" | "muteObject"
  >;
}

export function DashboardSidebarRail({
  navItems,
  referralCode,
  inviteReward,
  isAdmin,
  profile,
  userEmail,
  currentLocale,
  activeSubject,
  notificationInbox,
  notificationOperations,
}: DashboardSidebarRailProps) {
  const t = useTranslations("dashboard.home");
  const tNav = useTranslations("dashboard.nav");
  const [referralOpen, setReferralOpen] = useState(false);
  const pathname = usePathname();
  const reducedMotion = useReducedMotion();

  const isActiveItem = (item: DashboardSidebarNavItem) => {
    if (!item.href || item.status === "coming-soon") {
      return false;
    }

    if (item.key === "dashboard") {
      return (
        pathname === "/dashboard" || pathname.startsWith("/dev/dashboard-qa")
      );
    }

    if (item.key === "practice") {
      return pathname.startsWith("/practice");
    }

    if (item.key === "duel") {
      return pathname.startsWith("/debates");
    }

    if (item.key === "leaderboards") {
      return (
        pathname.startsWith("/leaderboards") ||
        pathname.startsWith("/dev/leaderboards-qa")
      );
    }

    if (item.key === "courses") {
      return (
        pathname.startsWith("/courses") ||
        pathname.startsWith("/dashboard/courses")
      );
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

    if (item.key === "resources") {
      return pathname.startsWith("/resources");
    }

    if (item.key === "ielts_home") {
      return pathname === "/ielts/home";
    }

    if (item.key === "ielts_learn") {
      return pathname.startsWith("/ielts/learn");
    }

    if (item.key === "ielts_speaking") {
      return pathname.startsWith("/ielts/speaking-rehearsal");
    }

    if (item.key === "ielts_library") {
      return pathname.startsWith("/ielts/tests");
    }
    if (item.key === "ielts_assigned") {
      return pathname.startsWith("/ielts/assigned");
    }

    if (item.key === "ielts_classes") {
      return pathname.startsWith("/ielts/classes");
    }

    return pathname === item.href;
  };

  return (
    <>
      <div aria-hidden="true" className="hidden h-dvh w-55 shrink-0 md:block" />
      <aside
        data-thinkfy-v2="rail"
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden h-dvh w-55 shrink-0 overflow-hidden overscroll-none border-r md:flex md:flex-col",
          "border-sidebar-muted/15 bg-sidebar text-sidebar-foreground",
        )}
      >
        <div className="flex h-14 shrink-0 items-center px-4">
          <LogoMark size="sm" variant="light" className="dark:hidden" />
          <LogoMark
            size="sm"
            variant="dark"
            className="hidden dark:inline-flex"
          />
        </div>

        <div className="px-2 pt-3">
          <ModeSwitcher
            variant="sidebar"
            currentLocale={currentLocale}
            currentSubject={activeSubject}
            ieltsAvailable={IELTS_ENABLED || isAdmin}
          />
        </div>

        <nav className="scrollbar-hide flex min-h-0 flex-1 flex-col gap-1 overflow-hidden overscroll-none px-2 py-3">
          {navItems.map((item) => {
            const Icon = NAV_ICONS[item.key];
            const href = item.href;
            const isUnavailable = item.status === "coming-soon" || !href;
            const isActive = isActiveItem(item);
            const label =
              item.key === "analytics" ? tNav("profile") : tNav(item.key);

            const content = (
              <>
                <span className="flex min-w-0 items-center gap-3">
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="truncate">{label}</span>
                </span>
                {isUnavailable ? (
                  <span
                    className={cn(
                      "type-caption ml-2 inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold uppercase",
                      "bg-sidebar-muted/10 text-sidebar-muted/75",
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
                    "text-sidebar-muted/50",
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
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "group relative isolate flex h-8 items-center justify-between rounded-lg px-2 text-sm font-medium transition-all",
                  isActive ? "sidebar-nav-selected-motion" : "sidebar-nav-idle",
                )}
              >
                {isActive ? (
                  <motion.span
                    layoutId="dashboard-sidebar-active"
                    transition={
                      reducedMotion
                        ? { duration: 0 }
                        : {
                            type: "spring",
                            stiffness: 360,
                            damping: 28,
                            mass: 0.8,
                          }
                    }
                    className="sidebar-nav-active-marker pointer-events-none absolute inset-0 z-0 rounded-lg"
                    aria-hidden="true"
                  />
                ) : null}
                <span className="relative z-10 flex min-w-0 flex-1 items-center justify-between">
                  {content}
                </span>
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
                if (referralCode) setReferralOpen(true);
              }}
              data-testid="dashboard-sidebar-referral"
              className={cn(
                "flex h-8 w-full items-center justify-between rounded-lg px-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                "sidebar-nav-action",
              )}
            >
              <span className="flex min-w-0 items-center gap-3">
                <Gift
                  className={cn("h-5 w-5 shrink-0", "text-sidebar-muted")}
                />
                <span className="truncate">
                  {t("invite_friend_reward", { count: inviteReward })}
                </span>
              </span>
              <ChevronRight className="h-4 w-4" />
            </button>
            {isAdmin ? (
              <>
                <Link
                  href="/dashboard/admin"
                  className={cn(
                    "flex h-8 items-center gap-3 rounded-lg px-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    pathname.startsWith("/dashboard/admin")
                      ? "sidebar-nav-selected hover:bg-[var(--sidebar-selected-bg)]"
                      : "sidebar-nav-action",
                  )}
                >
                  <Shield className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>{tNav("adminShort")}</span>
                </Link>
                <Link
                  href="/dashboard/teacher"
                  className={cn(
                    "flex h-8 items-center gap-3 rounded-lg px-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                    pathname.startsWith("/dashboard/teacher")
                      ? "sidebar-nav-selected hover:bg-[var(--sidebar-selected-bg)]"
                      : "sidebar-nav-action",
                  )}
                >
                  <GraduationCap
                    className="h-5 w-5 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{tNav("teacherMode")}</span>
                </Link>
              </>
            ) : null}
            <NotificationCenter
              variant="sidebar"
              snapshot={notificationInbox}
              operations={notificationOperations}
            />
            <ThemeToggle />
            <Link
              href="/settings"
              className={cn(
                "flex h-8 items-center gap-3 rounded-lg px-2 text-sm font-medium transition-colors",
                "sidebar-nav-action",
              )}
            >
              <Settings className="h-5 w-5 shrink-0" />
              <span className="truncate">{t("settings_label")}</span>
            </Link>
            <SupportIssueDialog
              profile={profile}
              userEmail={userEmail}
              triggerClassName={"sidebar-nav-action"}
            />
            <ReferralCreditsDialog
              open={referralOpen}
              onOpenChange={setReferralOpen}
              referralCode={referralCode}
              inviteReward={inviteReward}
            />
          </div>
        </div>
      </aside>
    </>
  );
}
