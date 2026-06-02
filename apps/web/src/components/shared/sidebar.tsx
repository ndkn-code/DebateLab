"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  LayoutDashboard,
  MessageCircle,
  Settings,
  LogOut,
  User,
  UserRound,
  ChevronLeft,
  Lock,
  Menu,
  Shield,
  Scale,
  Swords,
  Trophy,
} from "@/components/ui/icons";
import { OrbBalance } from "@/components/shared/orb-balance";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import posthog from "posthog-js";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { LEADERBOARDS_ENABLED, STUDENT_COURSES_ENABLED } from "@/lib/features";
import type { Profile } from "@/types/database";
import { DashboardSidebarRail } from "@/components/dashboard/dashboard-sidebar-rail";
import { DebateModeSwitcher } from "@/components/shared/debate-mode-switcher";
import { LogoMark } from "@/components/landing/logo-mark";
import { SupportIssueDialog } from "@/components/support/support-issue-dialog";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import type { DashboardNavItem } from "@/lib/api/dashboard";
import { coerceAppLocale, type AppLocale } from "@/lib/locale-switch";
import { REFERRAL_REWARD_CREDITS } from "@/lib/referrals/constants";

const NAV_ITEMS = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard, status: "live" },
  { href: "/practice", key: "practice", icon: Scale, status: "live" },
  {
    href: LEADERBOARDS_ENABLED ? "/leaderboards" : undefined,
    key: "leaderboards",
    icon: Trophy,
    status: LEADERBOARDS_ENABLED ? "live" : "coming-soon",
  },
  { href: "/debates", key: "duel", icon: Swords, status: "live" },
  { href: "/chat", key: "chat", icon: MessageCircle, status: "live" },
  { href: "/profile", key: "analytics", icon: UserRound, status: "live" },
] as const;

interface SidebarProps {
  profile: Profile | null;
  userEmail: string | null;
}

function NavContent({
  collapsed,
  profile,
  userEmail,
  onSignOut,
  onNavClick,
  currentLocale,
}: {
  collapsed: boolean;
  profile: SidebarProps["profile"];
  userEmail: SidebarProps["userEmail"];
  onSignOut: () => void;
  onNavClick?: () => void;
  currentLocale: AppLocale;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('dashboard.nav');
  const tc = useTranslations('common');
  const ts = useTranslations('dashboard.home');
  const isAdmin = profile?.role === "admin";
  const displayName =
    profile?.display_name || userEmail?.split("@")[0] || "User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Logo */}
      <div
        className={cn(
          "flex h-14 shrink-0 items-center px-4",
          collapsed ? "justify-center" : "gap-2"
        )}
      >
        <LogoMark
          size={collapsed ? "icon" : "sm"}
          markOnly={collapsed}
          variant="dark"
        />
      </div>

      {!collapsed ? (
        <div className="px-2 pt-3">
          <DebateModeSwitcher
            variant="sidebar"
            currentLocale={currentLocale}
          />
        </div>
      ) : null}

      {/* Credit Balance */}
      {profile?.orb_balance !== undefined && (
        <div
          className={cn(
            "mx-3 mt-3 flex items-center gap-2 rounded-xl border border-warning/25 bg-white/[0.08] px-3 py-2 text-sidebar-foreground",
            collapsed && "justify-center px-2"
          )}
        >
          <OrbBalance balance={profile.orb_balance} size="sm" />
          {!collapsed && (
            <span className="text-xs text-sidebar-muted">Credits</span>
          )}
        </div>
      )}

      {/* Nav Links */}
      <nav className="scrollbar-hide flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-2 py-3 md:overflow-hidden md:overscroll-none">
        {NAV_ITEMS.map((item) => {
          const href = item.href;
          const isActive = href
            ? pathname === href ||
              (item.key === "duel"
                ? pathname.startsWith("/debates")
                : href !== "/dashboard" && pathname.startsWith(href))
            : false;
          const Icon = item.icon;
          const label = item.key === "analytics" ? t("profile") : t(item.key);
          const isUnavailable =
            item.status === "coming-soon" || !href || (item.key === "duel" && !isAdmin);
          const content = (
            <>
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && (
                <>
                  <span className="truncate">{label}</span>
                  {isUnavailable ? (
                    <span className="ml-auto inline-flex shrink-0 items-center gap-1 rounded-full bg-white/[0.08] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-sidebar-muted/75">
                      <Lock className="h-3 w-3" />
                      {ts("coming_soon")}
                    </span>
                  ) : null}
                </>
              )}
            </>
          );

          if (isUnavailable || !href) {
            return (
              <div
                key={item.key}
                aria-disabled="true"
                className={cn(
                  "flex h-8 cursor-not-allowed items-center gap-3 rounded-lg px-2 text-sm font-medium text-sidebar-muted/50 opacity-75",
                  collapsed && "justify-center px-0"
                )}
                title={collapsed ? `${label} - ${ts("coming_soon")}` : undefined}
              >
                {content}
              </div>
            );
          }

          return (
            <Link
              key={item.key}
              href={href}
              onClick={onNavClick}
              className={cn(
                "flex h-8 items-center gap-3 rounded-lg px-2 text-sm font-medium transition-all",
                collapsed && "justify-center px-0",
                isActive
                  ? "bg-white/[0.12] text-sidebar-foreground shadow-[inset_0_0_0_1px_rgba(169,198,251,0.16)]"
                  : "text-sidebar-muted/85 hover:bg-white/[0.08] hover:text-sidebar-foreground"
              )}
              title={collapsed ? label : undefined}
            >
              {content}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="shrink-0 space-y-1 p-2">
        <ThemeToggle collapsed={collapsed} />
        {!collapsed ? (
          <SupportIssueDialog
            profile={profile}
            userEmail={userEmail}
            triggerClassName="text-sidebar-muted/85 hover:bg-white/[0.08] hover:text-sidebar-foreground"
          />
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex h-9 w-full items-center gap-3 rounded-lg px-2 text-sm transition-colors hover:bg-white/[0.08]",
              collapsed && "justify-center px-0"
            )}
          >
            <Avatar size="sm">
              {profile?.avatar_url && (
                <AvatarImage src={profile.avatar_url} alt={displayName} />
              )}
              <AvatarFallback className="bg-primary-container text-on-primary-container text-xs font-bold">
                {initials}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="min-w-0 flex-1 text-left">
                <p className="truncate text-sm font-medium text-sidebar-foreground">
                  {displayName}
                </p>
                <p className="truncate text-xs text-sidebar-muted/75">
                  {profile?.role ?? ts("student")}
                </p>
              </div>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" sideOffset={8}>
            <DropdownMenuItem onClick={() => { onNavClick?.(); router.push('/profile'); }}>
              <User className="h-4 w-4" />
              {t('profile')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { onNavClick?.(); router.push('/settings'); }}>
              <Settings className="h-4 w-4" />
              {t('settings')}
            </DropdownMenuItem>
            {profile?.role === 'admin' && (
              <DropdownMenuItem onClick={() => { onNavClick?.(); router.push('/dashboard/admin'); }}>
                <Shield className="h-4 w-4" />
                {t('switchToAdmin')}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onSignOut}>
              <LogOut className="h-4 w-4" />
              {tc('sign_out')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

export function Sidebar({ profile, userEmail }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = coerceAppLocale(useLocale());
  const tc = useTranslations('common');
  const useDashboardRail = !pathname.startsWith("/dashboard/admin");
  const isAdmin = profile?.role === "admin";
  const dashboardNavItems: DashboardNavItem[] = [
    { key: "dashboard", href: "/dashboard", status: "live" },
    { key: "practice", href: "/practice", status: "live" },
    {
      key: "leaderboards",
      href: LEADERBOARDS_ENABLED ? "/leaderboards" : undefined,
      status: LEADERBOARDS_ENABLED ? "live" : "coming-soon",
    },
    {
      key: "duel",
      href: isAdmin ? "/debates" : undefined,
      status: isAdmin ? "live" : "coming-soon",
    },
    ...(STUDENT_COURSES_ENABLED
      ? ([
          {
            key: "courses",
            href: "/courses",
            status: "live",
          },
        ] satisfies DashboardNavItem[])
      : []),
    { key: "coach", href: "/chat?context=coach-home", status: "live" },
    { key: "analytics", href: "/profile", status: "live" },
  ];

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    posthog.reset();
    router.push("/");
    router.refresh();
  };

  return (
    <>
      {/* Desktop sidebar */}
      {useDashboardRail ? (
        <DashboardSidebarRail
          navItems={dashboardNavItems}
          referralCode={profile?.referral_code ?? null}
          inviteReward={REFERRAL_REWARD_CREDITS}
          isAdmin={isAdmin}
          profile={profile}
          userEmail={userEmail}
          currentLocale={currentLocale}
        />
      ) : (
        <aside
          className={cn(
            "relative hidden h-dvh shrink-0 self-start flex-col overflow-hidden overscroll-none border-r border-sidebar-muted/15 bg-sidebar text-sidebar-foreground transition-all duration-200 md:sticky md:top-0 md:flex",
            collapsed ? "w-16" : "w-55"
          )}
        >
          <NavContent
            collapsed={collapsed}
            profile={profile}
            userEmail={userEmail}
            onSignOut={handleSignOut}
            currentLocale={currentLocale}
          />
          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="absolute right-2 top-4 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-sidebar-muted/20 bg-white/[0.08] text-sidebar-muted shadow-sm transition-colors hover:bg-white/[0.12] hover:text-sidebar-foreground"
          >
            <ChevronLeft
              className={cn(
                "h-3.5 w-3.5 transition-transform",
                collapsed && "rotate-180"
              )}
            />
          </button>
        </aside>
      )}

      {/* Mobile top bar + sheet */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-sidebar-muted/15 bg-sidebar px-4 text-sidebar-foreground md:hidden">
        <Sheet>
          <SheetTrigger
            aria-label={tc("navigation")}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-sidebar-muted hover:bg-white/[0.08] hover:text-sidebar-foreground"
          >
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-55 border-sidebar-muted/15 bg-sidebar p-0 text-sidebar-foreground"
            showCloseButton={false}
          >
            <SheetTitle className="sr-only">{tc('navigation')}</SheetTitle>
            <NavContent
              collapsed={false}
              profile={profile}
              userEmail={userEmail}
              onSignOut={handleSignOut}
              currentLocale={currentLocale}
              onNavClick={() => {
                // Sheet auto-closes when navigation happens via link click
              }}
            />
          </SheetContent>
        </Sheet>
        <LogoMark size="icon" markOnly variant="dark" />
        <DebateModeSwitcher variant="mobile" currentLocale={currentLocale} />
        <ThemeToggle variant="mobile" className="ml-auto" />
        <div className="shrink-0">
          <Avatar size="sm">
            {profile?.avatar_url && (
              <AvatarImage src={profile.avatar_url} alt="User" />
            )}
            <AvatarFallback className="bg-primary-container text-on-primary-container text-xs font-bold">
              {(profile?.display_name || userEmail || "U")
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
      </div>
    </>
  );
}
