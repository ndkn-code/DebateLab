"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { AlertTriangle } from "@/components/ui/icons";
import { fetchPublicMaintenanceState } from "@/lib/maintenance/client";
import { localizedMessage, type MaintenanceState } from "@/lib/maintenance/model";

export function MaintenanceBanner() {
  const locale = useLocale();
  const pathname = usePathname();
  const t = useTranslations("maintenance");
  const [state, setState] = useState<MaintenanceState | null>(null);
  const hidden = pathname.includes("/dashboard/admin") || pathname.includes("/maintenance");

  useEffect(() => {
    if (hidden) return;
    let mounted = true;
    const refresh = async () => {
      try {
        const nextState = await fetchPublicMaintenanceState();
        if (mounted) setState(nextState.mode === "banner" ? nextState : null);
      } catch {
        if (mounted) setState(null);
      }
    };
    void refresh();
    const interval = window.setInterval(refresh, 30_000);
    return () => {
      mounted = false;
      window.clearInterval(interval);
    };
  }, [hidden]);

  if (hidden || !state) return null;
  return (
    <aside className="border-b border-warning/30 bg-warning/15 px-4 py-3 text-on-surface" role="status">
      <div className="mx-auto flex max-w-6xl items-start gap-3 text-sm font-semibold">
        <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <p>
          <span className="font-extrabold">{t("bannerLabel")}: </span>
          {localizedMessage(state.bannerMessage, locale)}
        </p>
      </div>
    </aside>
  );
}
