"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles } from "@/components/ui/icons";
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
          className="mb-4 overflow-hidden"
        >
          <div className="relative rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3">
            {/* Dismiss */}
            <button
              onClick={handleDismiss}
              type="button"
              aria-label={t("dismiss_welcome")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-control p-1.5 text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3 pr-8">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-primary-container">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>

              <div className="flex-1">
                <h3 className="type-body-sm font-semibold text-on-surface">
                  {t("welcome_banner", { name: displayName })}
                </h3>
                <p className="type-caption mt-0.5 text-on-surface-variant">
                  {t("welcome_banner_subtitle")}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
