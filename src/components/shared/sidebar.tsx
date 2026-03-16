"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/types/database";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/courses", label: "My Courses", icon: BookOpen },
  { href: "/practice", label: "Practice", icon: Mic },
  { href: "/chat", label: "AI Coach", icon: MessageCircle },
  { href: "/history", label: "History", icon: Clock },
  { href: "/settings", label: "Settings", icon: Settings },
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
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span>{item.label}</span>}
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
                  {profile?.role ?? "student"}
                </p>
              </div>
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" sideOffset={8}>
            <DropdownMenuItem>
              <User className="h-4 w-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onSignOut}>
              <LogOut className="h-4 w-4" />
              Sign Out
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

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
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
            <SheetTitle className="sr-only">Navigation</SheetTitle>
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
