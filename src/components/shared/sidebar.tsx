"use client";

import { useState } from "react";
import { Link } from "@/i18n/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  LayoutDashboard,
  BookOpen,
  Mic,
  MessageCircle,
  Clock,
  Settings,
  LogOut,
  User,
  ChevronLeft,
  Menu,
  Shield,
} from "lucide-react";
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
import type { Profile } from "@/types/database";

const NAV_ITEMS = [
  { href: "/dashboard", key: "dashboard", icon: LayoutDashboard },
  { href: "/courses", key: "courses", icon: BookOpen },
  { href: "/practice", key: "practice", icon: Mic },
  { href: "/chat", key: "chat", icon: MessageCircle },
  { href: "/history", key: "history", icon: Clock },
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
}: {
  collapsed: boolean;
  profile: SidebarProps["profile"];
  userEmail: SidebarProps["userEmail"];
  onSignOut: () => void;
  onNavClick?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations('dashboard.nav');
  const tc = useTranslations('common');
  const ts = useTranslations('dashboard.home');
  const displayName =
    profile?.display_name || userEmail?.split("@")[0] || "User";
  const initials = displayName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center border-b border-outline-variant/10 px-4",
          collapsed ? "justify-center" : "gap-2"
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary text-sm font-extrabold">
          D
        </div>
        {!collapsed && (
          <span className="text-lg font-extrabold text-primary tracking-tight">
            DebateLab
          </span>
        )}
      </div>

      {/* Nav Links */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          const Icon = item.icon;
          const label = t(item.key);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all min-h-[44px]",
                collapsed && "justify-center px-0",
                isActive
                  ? "bg-primary text-on-primary shadow-sm shadow-primary/20"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              )}
              title={collapsed ? label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="shrink-0 border-t border-outline-variant/10 p-3">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-surface-container",
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
                <p className="truncate text-sm font-medium text-on-surface">
                  {displayName}
                </p>
                <p className="truncate text-xs text-on-surface-variant">
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
  const tc = useTranslations('common');

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
      <aside
        className={cn(
          "hidden md:flex flex-col h-screen sticky top-0 border-r border-outline-variant/10 bg-surface-container-lowest transition-all duration-200",
          collapsed ? "w-16" : "w-60"
        )}
      >
        <NavContent
          collapsed={collapsed}
          profile={profile}
          userEmail={userEmail}
          onSignOut={handleSignOut}
        />
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 z-10 flex h-6 w-6 items-center justify-center rounded-full border border-outline-variant/20 bg-surface-container-lowest text-on-surface-variant shadow-sm transition-colors hover:bg-surface-container"
        >
          <ChevronLeft
            className={cn(
              "h-3.5 w-3.5 transition-transform",
              collapsed && "rotate-180"
            )}
          />
        </button>
      </aside>

      {/* Mobile top bar + sheet */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-outline-variant/10 bg-surface-container-lowest/80 backdrop-blur-xl px-4 md:hidden">
        <Sheet>
          <SheetTrigger className="flex h-11 w-11 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container">
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0" showCloseButton={false}>
            <SheetTitle className="sr-only">{tc('navigation')}</SheetTitle>
            <NavContent
              collapsed={false}
              profile={profile}
              userEmail={userEmail}
              onSignOut={handleSignOut}
              onNavClick={() => {
                // Sheet auto-closes when navigation happens via link click
              }}
            />
          </SheetContent>
        </Sheet>
        <span className="text-lg font-extrabold text-primary tracking-tight">
          DebateLab
        </span>
        <div className="ml-auto">
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
