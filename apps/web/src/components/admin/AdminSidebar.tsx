"use client";

import { usePathname } from "@/i18n/navigation";
import { useLocale, useTranslations } from "next-intl";
import {
  AlertCircle,
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
  XIcon,
} from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { useAdminStore } from "@/lib/stores/adminStore";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { ORGANIZATIONS_V1 } from "@/lib/features";
import { WorkspaceSwitcher } from "@/components/shared/workspace-switcher";
import { ModeSwitcher } from "@/components/shared/mode-switcher";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { coerceAppLocale } from "@/lib/locale-switch";
import type { Subject } from "@/lib/subject";

const ADMIN_NAV = [
  {
    href: "/dashboard/admin/overview",
    key: "overview" as const,
    icon: BarChart3,
  },
  {
    href: "/dashboard/admin/ai-quality",
    key: "aiQuality" as const,
    icon: BrainCircuit,
  },
  {
    href: "/dashboard/admin/prediction-quality",
    key: "predictionQuality" as const,
    icon: Gauge,
  },
  {
    href: "/dashboard/admin/ui-showcase",
    key: "uiShowcase" as const,
    icon: LayoutGrid,
  },
  { href: "/dashboard/admin/corpus", key: "corpus" as const, icon: Layers3 },
  { href: "/dashboard/admin/users", key: "users" as const, icon: Users },
  {
    href: "/dashboard/admin/reports",
    key: "reports" as const,
    icon: AlertCircle,
  },
  { href: "/dashboard/admin/referrals", key: "referrals" as const, icon: Gift },
  {
    href: "/dashboard/admin/classes",
    key: "classes" as const,
    icon: CalendarDays,
  },
  {
    href: ORGANIZATIONS_V1
      ? "/dashboard/admin/organizations"
      : "/dashboard/admin/clubs",
    key: ORGANIZATIONS_V1 ? ("organizations" as const) : ("clubs" as const),
    icon: Building2,
  },
  { href: "/dashboard/admin/emails", key: "emails" as const, icon: Mail },
  {
    href: "/dashboard/admin/feedback-popups",
    key: "feedbackPopups" as const,
    icon: MessageSquareText,
  },
  {
    href: "/dashboard/admin/maintenance",
    key: "maintenance" as const,
    icon: Settings,
  },
  { href: "/dashboard/admin/courses", key: "courses" as const, icon: BookOpen },
  {
    href: "/dashboard/admin/vocabulary",
    key: "vocabulary" as const,
    icon: Languages,
  },
  {
    href: "/dashboard/admin/resources",
    key: "resources" as const,
    icon: BookOpenText,
  },
  {
    href: "/dashboard/admin/ielts",
    key: "ielts" as const,
    icon: GraduationCap,
  },
  {
    href: "/dashboard/admin/question-bank",
    key: "questionBank" as const,
    icon: ListFilter,
  },
  { href: "/dashboard/admin/duels", key: "duels" as const, icon: Swords },
  { href: "/dashboard/admin/motions", key: "motions" as const, icon: FileText },
] as const;

const ADMIN_GROUPS = [
  { key: "workspace", items: ADMIN_NAV.slice(0, 5) },
  { key: "peoplePrograms", items: ADMIN_NAV.slice(5, 10) },
  { key: "contentTools", items: ADMIN_NAV.slice(10) },
] as const;

function NavLinks({
  activeMarkerId,
  onNavClick,
  activeSubject,
  userId,
}: {
  activeMarkerId: string;
  onNavClick?: () => void;
  activeSubject: Subject;
  userId: string;
}) {
  const pathname = usePathname();
  const t = useTranslations("admin");
  const reducedMotion = useReducedMotion();
  const locale = coerceAppLocale(useLocale());
  const activeHref = ADMIN_NAV.filter((item) =>
    pathname.startsWith(item.href),
  ).sort((left, right) => right.href.length - left.href.length)[0]?.href;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="flex h-16 shrink-0 items-center gap-3 border-b border-outline-variant px-5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-primary text-primary-foreground">
          <Shield className="h-4 w-4" aria-hidden="true" />
        </div>
        <span className="truncate type-title text-sidebar-foreground">
          {t("title")}
        </span>
      </div>

      <div className="px-3 pt-2">
        <WorkspaceSwitcher
          canTeach
          isAdmin
          activeSubject={activeSubject}
          userId={userId}
          onNavigate={onNavClick}
        />
      </div>

      {/* Nav */}
      <nav
        aria-label={t("title")}
        className="scrollbar-hide flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overscroll-contain px-3 py-4"
      >
        {ADMIN_GROUPS.map((group) => (
          <div key={group.key} className="space-y-1">
            <p className="type-eyebrow px-2 pb-1 text-sidebar-muted">
              {t(`groups.${group.key}`)}
            </p>
            {group.items.map((item) => {
              const isActive = item.href === activeHref;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavClick}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "type-label relative isolate flex min-h-9 items-center gap-3 rounded-control px-3 transition-[background-color,color,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:translate-y-px",
                    isActive
                      ? "sidebar-nav-selected-motion"
                      : "sidebar-nav-idle",
                  )}
                >
                  {isActive ? (
                    <motion.span
                      layoutId={activeMarkerId}
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
                      className="sidebar-nav-active-marker pointer-events-none absolute inset-0 z-0 rounded-control"
                      aria-hidden="true"
                    />
                  ) : null}
                  <Icon
                    className="relative z-10 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span className="relative z-10 truncate">
                    {t(`nav.${item.key}`)}
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="shrink-0 space-y-2 border-t border-outline-variant p-3">
        <ModeSwitcher
          variant="sidebar"
          currentLocale={locale}
          currentSubject={activeSubject}
          ieltsAvailable
        />
        <ThemeToggle />
      </div>
    </div>
  );
}

export function AdminSidebar({
  activeSubject,
  userId,
}: {
  activeSubject: Subject;
  userId: string;
}) {
  const { sidebarOpen, setSidebarOpen } = useAdminStore();
  const t = useTranslations("admin");
  const navT = useTranslations("dashboard.nav");

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden h-full w-60 shrink-0 flex-col overflow-hidden border-r border-outline-variant bg-sidebar text-sidebar-foreground lg:flex">
        <NavLinks
          activeMarkerId="admin-sidebar-active-desktop"
          activeSubject={activeSubject}
          userId={userId}
        />
      </aside>

      {/* Mobile top bar + sheet */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-outline-variant bg-sidebar px-4 text-sidebar-foreground lg:hidden">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger
            aria-label={t("title")}
            className="flex h-11 items-center gap-2 rounded-control px-3 type-label text-sidebar-muted transition-colors hover:bg-surface-container hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Menu className="size-5" aria-hidden="true" />
            <span>{navT("menu")}</span>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="w-60 border-outline-variant bg-sidebar p-0 text-sidebar-foreground"
            showCloseButton={false}
          >
            <SheetTitle className="sr-only">{t("title")}</SheetTitle>
            <SheetClose
              aria-label={navT("closeNavigation")}
              className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-control text-sidebar-muted transition-colors hover:bg-surface-container hover:text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <XIcon className="size-4" aria-hidden="true" />
            </SheetClose>
            <NavLinks
              activeMarkerId="admin-sidebar-active-mobile"
              onNavClick={() => setSidebarOpen(false)}
              activeSubject={activeSubject}
              userId={userId}
            />
          </SheetContent>
        </Sheet>
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-sidebar-muted" aria-hidden="true" />
          <span className="type-title text-sidebar-foreground">
            {t("title")}
          </span>
        </div>
      </div>
    </>
  );
}
