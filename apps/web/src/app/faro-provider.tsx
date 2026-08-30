"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import {
  initializeThinkfyFaro,
  pauseThinkfyFaro,
} from "@/lib/observability/faro-client";
import { stripUrlQuery } from "@/lib/observability/faro-sanitize";

export function FaroProvider({
  children,
  enabled,
}: {
  children: React.ReactNode;
  enabled: boolean;
}) {
  const pathname = usePathname();

  useEffect(() => {
    if (!enabled) {
      pauseThinkfyFaro();
      return;
    }

    initializeThinkfyFaro();
    return pauseThinkfyFaro;
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !pathname) return;
    initializeThinkfyFaro()?.api.setView({ name: stripUrlQuery(pathname) });
  }, [enabled, pathname]);

  return children;
}
