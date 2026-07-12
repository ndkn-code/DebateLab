"use client";

import { usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  BookOpen,
  BrainCircuit,
  Building2,
  CalendarDays,
  FileText,
  Gauge,
  Gift,
  GraduationCap,
  LayoutGrid,
  Layers3,
  Mail,
  Menu,
  MessageSquareText,
  Shield,
  Swords,
  Users,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { useAdminStore } from "@/lib/stores/adminStore";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";

const ADMIN_NAV = [
  { href: "/dashboard/admin/overview", key: "overview" as const, icon: BarChart3 },
  { href: "/dashboard/admin/ai-quality", key: "aiQuality" as const, icon: BrainCircuit },
  { href: "/dashboard/admin/prediction-quality", key: "predictionQuality" as const, icon: Gauge },
  { href: "/dashboard/admin/ui-showcase", key: "uiShowcase" as const, icon: LayoutGrid },
  { href: "/dashboard/admin/corpus", key: "corpus" as const, icon: Layers3 },
  { href: "/dashboard/admin/users", key: "users" as const, icon: Users },
  { href: "/dashboard/admin/reports", key: "reports" as const, icon: AlertCircle },
  { href: "/dashboard/admin/referrals", key: "referrals" as const, icon: Gift },
  { href: "/dashboard/admin/classes", key: "classes" as const, icon: CalendarDays },
  { href: "/dashboard/admin/clubs", key: "clubs" as const, icon: Building2 },
  { href: "/dashboard/admin/emails", key: "emails" as const, icon: Mail },
  { href: "/dashboard/admin/feedback-popups", key: "feedbackPopups" as const, icon: MessageSquareText },
  { href: "/dashboard/admin/courses", key: "courses" as const, icon: BookOpen },
  { href: "/dashboard/admin/ielts", key: "ielts" as const, icon: GraduationCap },
  { href: "/dashboard/admin/duels", key: "duels" as const, icon: Swords },
  { href: "/dashboard/admin/motions", key: "motions" as const, icon: FileText },
] as const;

function NavLinks({ onNavClick }: { onNavClick?: () => void }) {
  const pathname = usePathname();
  const t = useTranslations("admin");

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-muted/15 px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/[0.08] text-sidebar-muted">
          <Shield className="h-4 w-4" />
        </div>
        <span className="truncate text-base font-extrabold text-sidebar-foreground">
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
                  ? "sidebar-nav-selected"
                  : "sidebar-nav-idle"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="truncate">{t(`nav.${item.key}`)}</span>
            </Link>
          );
        })}
      </nav>

      {/* Back to Dashboard */}
      <div className="shrink-0 border-t border-sidebar-muted/15 p-2">
        <Link
          href="/dashboard"
          onClick={onNavClick}
          className="sidebar-nav-action flex h-8 items-center gap-3 rounded-lg px-2 text-sm font-medium transition-all"
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
      <aside className="hidden h-full w-55 shrink-0 flex-col overflow-hidden border-r border-sidebar-muted/15 bg-sidebar text-sidebar-foreground md:flex">
        <NavLinks />
      </aside>

      {/* Mobile top bar + sheet */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-sidebar-muted/15 bg-sidebar px-4 text-sidebar-foreground md:hidden">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger className="flex h-11 w-11 items-center justify-center rounded-lg text-sidebar-muted hover:bg-white/[0.08] hover:text-sidebar-foreground">
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-55 border-sidebar-muted/15 bg-sidebar p-0 text-sidebar-foreground"
            showCloseButton={false}
          >
            <SheetTitle className="sr-only">Admin Navigation</SheetTitle>
            <NavLinks onNavClick={() => setSidebarOpen(false)} />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-sidebar-muted" />
          <span className="text-lg font-extrabold tracking-tight text-sidebar-foreground">
            Admin
          </span>
        </div>
      </div>
    </>
  );
}
