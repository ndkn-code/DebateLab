"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import {
  ANALYTICS_CONSENT_CHANGED_EVENT,
  hasBrowserAnalyticsConsent,
  syncAnalyticsConsent,
} from "@/lib/analytics-consent";
import {
  initializeThinkfyFaro,
  pauseThinkfyFaro,
} from "@/lib/observability/faro-client";
import { stripUrlQuery } from "@/lib/observability/faro-sanitize";

export function FaroProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(() => hasBrowserAnalyticsConsent());

  useEffect(() => {
    const syncConsent = () => {
      setEnabled(hasBrowserAnalyticsConsent());
    };

    syncConsent();
    window.addEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, syncConsent);
    window.addEventListener("focus", syncConsent);

    return () => {
      window.removeEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, syncConsent);
      window.removeEventListener("focus", syncConsent);
    };
  }, []);

  useEffect(() => {
    syncAnalyticsConsent(
      enabled,
      () => initializeThinkfyFaro(),
      () => pauseThinkfyFaro()
    );

    return enabled ? pauseThinkfyFaro : undefined;
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !pathname) return;
    initializeThinkfyFaro()?.api.setView({ name: stripUrlQuery(pathname) });
  }, [enabled, pathname]);

  return children;
}
