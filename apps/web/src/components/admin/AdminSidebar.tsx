"use client";

import { usePathname } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  BookOpen,
  BookOpenText,
  BrainCircuit,
  Building2,
  CalendarDays,
  FileText,
  Gauge,
  Gift,
  GraduationCap,
  LayoutGrid,
  Languages,
  ListFilter,
  Layers3,
  Mail,
  Menu,
  MessageSquareText,
  Settings,
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
  { href: "/dashboard/admin/maintenance", key: "maintenance" as const, icon: Settings },
  { href: "/dashboard/admin/courses", key: "courses" as const, icon: BookOpen },
  { href: "/dashboard/admin/vocabulary", key: "vocabulary" as const, icon: Languages },
  { href: "/dashboard/admin/resources", key: "resources" as const, icon: BookOpenText },
  { href: "/dashboard/admin/ielts", key: "ielts" as const, icon: GraduationCap },
  { href: "/dashboard/admin/question-bank", key: "questionBank" as const, icon: ListFilter },
  { href: "/dashboard/admin/duels", key: "duels" as const, icon: Swords },
  { href: "/dashboard/admin/motions", key: "motions" as const, icon: FileText },
] as const;

const ADMIN_GROUPS = [
  { key: "workspace", items: ADMIN_NAV.slice(0, 5) },
  { key: "peoplePrograms", items: ADMIN_NAV.slice(5, 10) },
  { key: "contentTools", items: ADMIN_NAV.slice(10) },
] as const;

function NavLinks({ onNavClick }: { onNavClick?: () => void }) {
  const pathname = usePathname();
  const t = useTranslations("admin");

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-outline-variant px-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-primary text-primary-foreground">
          <Shield className="h-4 w-4" aria-hidden="true" />
        </div>
        <span className="truncate text-base font-semibold text-sidebar-foreground">
          {t("title")}
        </span>
      </div>

      {/* Nav */}
      <nav aria-label={t("title")} className="scrollbar-hide flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-3 py-4">
        {ADMIN_GROUPS.map((group) => <div key={group.key} className="space-y-1">
          <p className="type-eyebrow px-2 pb-1 text-sidebar-muted">{t(`groups.${group.key}`)}</p>
          {group.items.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={cn(
                "type-label flex min-h-9 items-center gap-3 rounded-[10px] px-3 transition-[background-color,color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:translate-y-px",
                isActive
                  ? "sidebar-nav-selected"
                  : "sidebar-nav-idle"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span className="truncate">{t(`nav.${item.key}`)}</span>
            </Link>
          );
          })}
        </div>)}
      </nav>

      {/* Back to Dashboard */}
      <div className="shrink-0 border-t border-outline-variant p-3">
        <Link
          href="/dashboard"
          onClick={onNavClick}
          className="sidebar-nav-action type-label flex min-h-9 items-center gap-3 rounded-[10px] px-3 transition-[background-color,color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 active:translate-y-px"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{t("backToDashboard")}</span>
        </Link>
      </div>
    </div>
  );
}

export function AdminSidebar() {
  const { sidebarOpen, setSidebarOpen } = useAdminStore();
  const t = useTranslations("admin");

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden h-full w-60 shrink-0 flex-col overflow-hidden border-r border-outline-variant bg-sidebar text-sidebar-foreground lg:flex">
        <NavLinks />
      </aside>

      {/* Mobile top bar + sheet */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-outline-variant bg-sidebar px-4 text-sidebar-foreground lg:hidden">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger aria-label={t("title")} className="flex h-11 w-11 items-center justify-center rounded-[10px] text-sidebar-muted transition-colors hover:bg-[var(--sidebar-hover-bg)] hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50">
            <Menu className="h-5 w-5" aria-hidden="true" />
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-60 border-outline-variant bg-sidebar p-0 text-sidebar-foreground"
            showCloseButton={false}
          >
            <SheetTitle className="sr-only">Admin Navigation</SheetTitle>
            <NavLinks onNavClick={() => setSidebarOpen(false)} />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-sidebar-muted" aria-hidden="true" />
          <span className="text-base font-semibold tracking-tight text-sidebar-foreground">
            Admin
          </span>
        </div>
      </div>
    </>
  );
}
