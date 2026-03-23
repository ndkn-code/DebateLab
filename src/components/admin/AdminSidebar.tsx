"use client";

import { usePathname, useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { BarChart3, BookOpen, ArrowLeft, Shield, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAdminStore } from "@/lib/stores/adminStore";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Link } from "@/i18n/navigation";

const ADMIN_NAV = [
  { href: "/dashboard/admin/overview", key: "overview" as const, icon: BarChart3 },
  { href: "/dashboard/admin/courses", key: "courses" as const, icon: BookOpen },
] as const;

function NavLinks({ onNavClick }: { onNavClick?: () => void }) {
  const pathname = usePathname();
  const t = useTranslations("admin");

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-outline-variant/10 px-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-on-primary">
          <Shield className="h-4 w-4" />
        </div>
        <span className="text-lg font-extrabold text-primary tracking-tight">
          {t("title")}
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {ADMIN_NAV.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all min-h-[44px]",
                isActive
                  ? "bg-primary text-on-primary shadow-sm shadow-primary/20"
                  : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
              )}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span>{t(`nav.${item.key}`)}</span>
            </Link>
          );
        })}
      </nav>

      {/* Back to Dashboard */}
      <div className="shrink-0 border-t border-outline-variant/10 p-3">
        <Link
          href="/dashboard"
          onClick={onNavClick}
          className="flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium text-on-surface-variant hover:bg-surface-container hover:text-on-surface transition-all min-h-[44px]"
        >
          <ArrowLeft className="h-5 w-5 shrink-0" />
          <span>{t("backToDashboard")}</span>
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
      <aside className="hidden md:flex flex-col h-screen sticky top-0 w-60 border-r border-outline-variant/10 bg-surface-container-lowest">
        <NavLinks />
      </aside>

      {/* Mobile top bar + sheet */}
      <div className="sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-outline-variant/10 bg-surface-container-lowest/80 backdrop-blur-xl px-4 md:hidden">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetTrigger className="flex h-11 w-11 items-center justify-center rounded-lg text-on-surface-variant hover:bg-surface-container">
            <Menu className="h-5 w-5" />
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0" showCloseButton={false}>
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
