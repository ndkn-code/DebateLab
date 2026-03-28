"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, Mic, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useTranslations } from "next-intl";

interface WelcomeBannerProps {
  displayName: string;
  userId: string;
  show: boolean;
}

export function WelcomeBanner({
  displayName,
  userId,
  show,
}: WelcomeBannerProps) {
  const [visible, setVisible] = useState(show);
  const t = useTranslations("dashboard.home");

  // Fire confetti on first render
  useEffect(() => {
    if (show) {
      const timer = setTimeout(async () => {
        const confetti = (await import("canvas-confetti")).default;
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.3 },
          colors: ["#2f4fdd", "#6366f1", "#a78bfa", "#f59e0b", "#10b981"],
        });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [show]);

  const handleDismiss = async () => {
    setVisible(false);
    const supabase = createClient();
    const { data: profile } = await supabase
      .from("profiles")
      .select("preferences")
      .eq("id", userId)
      .single();

    const prefs = (profile?.preferences as Record<string, unknown>) ?? {};
    await supabase
      .from("profiles")
      .update({
        preferences: { ...prefs, first_dashboard_visit: false },
      })
      .eq("id", userId);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -20, height: 0 }}
          animate={{ opacity: 1, y: 0, height: "auto" }}
          exit={{ opacity: 0, y: -20, height: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-6 overflow-hidden"
        >
          <div className="relative rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 p-6">
            {/* Dismiss */}
            <button
              onClick={handleDismiss}
              className="absolute right-3 top-3 rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>

              <div className="flex-1">
                <h3 className="text-lg font-bold text-on-surface">
                  {t("welcome_banner", { name: displayName })}
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  {t("welcome_banner_subtitle")}
                </p>
              </div>

              <Link href="/practice" className="shrink-0">
                <Button className="gap-2 rounded-xl bg-primary text-white">
                  <Mic className="h-4 w-4" />
                  {t("start_practice")}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
