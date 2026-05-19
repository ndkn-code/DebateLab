"use client";

import { usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { BarChart3, BookOpen, ArrowLeft, Shield, Menu, Swords, Users, CalendarDays, Building2, Mail, MessageSquareText } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { useAdminStore } from "@/lib/stores/adminStore";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";

const ADMIN_NAV = [
  { href: "/dashboard/admin/overview", key: "overview" as const, icon: BarChart3 },
  { href: "/dashboard/admin/users", key: "users" as const, icon: Users },
  { href: "/dashboard/admin/classes", key: "classes" as const, icon: CalendarDays },
  { href: "/dashboard/admin/clubs", key: "clubs" as const, icon: Building2 },
  { href: "/dashboard/admin/emails", key: "emails" as const, icon: Mail },
  { href: "/dashboard/admin/feedback-popups", key: "feedbackPopups" as const, icon: MessageSquareText },
  { href: "/dashboard/admin/courses", key: "courses" as const, icon: BookOpen },
  { href: "/dashboard/admin/duels", key: "duels" as const, icon: Swords },
] as const;

function NavLinks({ onNavClick }: { onNavClick?: () => void }) {
  const pathname = usePathname();
  const t = useTranslations("admin");

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-outline-variant/10 px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Shield className="h-4 w-4" />
        </div>
        <span className="truncate text-base font-extrabold text-primary">
          {t("title")}
        </span>
      </div>

      {/* Nav */}
      <nav className="scrollbar-hide flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain px-2 py-3">
        {ADMIN_NAV.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={cn(
                "flex h-8 items-center gap-3 rounded-lg px-2 text-sm font-medium transition-all",
                isActive
                  ? "bg-primary/10 text-primary shadow-[inset_0_0_0_1px_rgba(77,134,247,0.14)]"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{t(`nav.${item.key}`)}</span>
            </Link>
          );
        })}
      </nav>

      {/* Back to Dashboard */}
      <div className="shrink-0 border-t border-outline-variant/10 p-2">
        <Link
          href="/dashboard"
          onClick={onNavClick}
          className="flex h-8 items-center gap-3 rounded-lg px-2 text-sm font-medium text-on-surface-variant transition-all hover:bg-surface-container hover:text-on-surface"
        >
          <ArrowLeft className="h-5 w-5 shrink-0" />
          <span className="truncate">{t("backToDashboard")}</span>
        </Link>
      </div>
    </div>
  );
}

export function AdminSidebar() {
  const { sidebarOpen, setSidebarOpen } = useAdminStore();

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden h-full w-55 shrink-0 flex-col overflow-hidden border-r border-outline-variant/15 bg-surface-container-lowest md:flex">
        <NavLinks />
      </aside>

      {/* Mobile top bar + sheet */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-outline-variant/10 bg-surface-container-lowest/80 backdrop-blur-xl px-4 md:hidden">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger className="flex h-11 w-11 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container">
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-55 p-0" showCloseButton={false}>
            <SheetTitle className="sr-only">Admin Navigation</SheetTitle>
            <NavLinks onNavClick={() => setSidebarOpen(false)} />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <span className="text-lg font-extrabold text-primary tracking-tight">
            Admin
          </span>
        </div>
      </div>
    </>
  );
}
