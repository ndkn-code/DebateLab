"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Menu, X } from "lucide-react";
import { LanguageToggle } from "@/components/ui/language-toggle";
import { cn } from "@/lib/utils";

interface LandingNavbarProps {
  isLoggedIn: boolean;
}

export function LandingNavbar({ isLoggedIn }: LandingNavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const t = useTranslations("landing.nav");

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handler);
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <nav
      className={cn(
        "fixed top-0 w-full z-50 transition-all duration-300",
        scrolled
          ? "bg-white/80 backdrop-blur-md shadow-sm border-b border-gray-100"
          : "bg-transparent"
      )}
    >
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <span className="text-2xl font-extrabold bg-gradient-to-r from-[#2f4fdd] to-[#4f46e5] bg-clip-text text-transparent tracking-tight">
            DebateLab
          </span>
          <div className="hidden md:flex items-center gap-8">
            <a
              className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
              href="#features"
            >
              {t("features")}
            </a>
            <a
              className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
              href="#how-it-works"
            >
              {t("howItWorks")}
            </a>
          </div>
        </div>

        <div className="hidden md:flex items-center gap-4">
          <LanguageToggle />
          {isLoggedIn ? (
            <Link
              href="/dashboard"
              className="bg-gradient-to-r from-[#2f4fdd] to-[#4f46e5] text-white px-8 py-3 rounded-full font-bold text-sm shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
            >
              {t("dashboard")}
            </Link>
          ) : (
            <>
              <Link
                href="/auth/login"
                className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors"
              >
                {t("login")}
              </Link>
              <Link
                href="/auth/signup"
                className="bg-gradient-to-r from-[#2f4fdd] to-[#4f46e5] text-white px-8 py-3 rounded-full font-bold text-sm shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
              >
                {t("signup")}
              </Link>
            </>
          )}
        </div>

        <button
          className="md:hidden text-on-surface-variant hover:text-primary transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
        >
          {mobileOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </div>

      {/* Mobile menu overlay */}
      {mobileOpen && (
        <div className="md:hidden border-t border-outline-variant/10 bg-white/95 backdrop-blur-sm">
          <div className="flex flex-col gap-1 px-6 py-4">
            <a
              className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors py-3"
              href="#features"
              onClick={() => setMobileOpen(false)}
            >
              {t("features")}
            </a>
            <a
              className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors py-3"
              href="#how-it-works"
              onClick={() => setMobileOpen(false)}
            >
              {t("howItWorks")}
            </a>

            <div className="flex justify-center py-2">
              <LanguageToggle />
            </div>

            <div className="border-t border-outline-variant/10 mt-2 pt-4 flex flex-col gap-3">
              {isLoggedIn ? (
                <Link
                  href="/dashboard"
                  className="bg-gradient-to-r from-[#2f4fdd] to-[#4f46e5] text-white px-8 py-3 rounded-full font-bold text-sm shadow-lg shadow-primary/20 text-center"
                  onClick={() => setMobileOpen(false)}
                >
                  {t("dashboard")}
                </Link>
              ) : (
                <>
                  <Link
                    href="/auth/login"
                    className="text-sm font-semibold text-on-surface-variant hover:text-primary transition-colors py-3 text-center"
                    onClick={() => setMobileOpen(false)}
                  >
                    {t("login")}
                  </Link>
                  <Link
                    href="/auth/signup"
                    className="bg-gradient-to-r from-[#2f4fdd] to-[#4f46e5] text-white px-8 py-3 rounded-full font-bold text-sm shadow-lg shadow-primary/20 text-center"
                    onClick={() => setMobileOpen(false)}
                  >
                    {t("signup")}
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
