"use client";

import { useEffect, useMemo, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  inferFeatureAreaFromRoute,
  normalizeAnalyticsEventInput,
  type AnalyticsEventInput,
} from "@/lib/analytics/events";

function getStoredSessionId() {
  if (typeof window === "undefined") return null;
  return window.sessionStorage.getItem("dl_session_id");
}

function sendAnalyticsPayload(payload: AnalyticsEventInput, keepalive = false) {
  try {
    const event = normalizeAnalyticsEventInput({
      ...payload,
      sessionId: payload.sessionId ?? getStoredSessionId(),
    });
    const body = JSON.stringify(event);

    if (keepalive && typeof navigator !== "undefined" && "sendBeacon" in navigator) {
      const sent = navigator.sendBeacon(
        "/api/analytics/events",
        new Blob([body], { type: "application/json" })
      );
      if (sent) return;
    }

    void fetch("/api/analytics/events", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive,
    }).catch(() => undefined);
  } catch {
    // Analytics should never interrupt the product experience.
  }
}

export function trackAnalyticsEvent(payload: AnalyticsEventInput, keepalive = false) {
  sendAnalyticsPayload(payload, keepalive);
}

export function useAnalyticsEventTracker(userId: string | undefined) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeRouteRef = useRef<{ route: string; startedAt: number } | null>(null);

  const route = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  useEffect(() => {
    if (!userId || !route) return;

    const startedAt = performance.now();
    sendAnalyticsPayload({
      eventName: "page_view",
      featureArea: inferFeatureAreaFromRoute(route),
      route,
      metadata: { pathname },
    });
    activeRouteRef.current = { route, startedAt };

    return () => {
      const activeRoute = activeRouteRef.current;
      if (!activeRoute || activeRoute.route !== route) return;
      sendAnalyticsPayload(
        {
          eventName: "page_leave",
          featureArea: inferFeatureAreaFromRoute(activeRoute.route),
          route: activeRoute.route,
          durationMs: performance.now() - activeRoute.startedAt,
          metadata: { pathname },
        },
        true
      );
      activeRouteRef.current = null;
    };
  }, [pathname, route, userId]);

  useEffect(() => {
    if (!userId) return;

    const handleBeforeUnload = () => {
      const activeRoute = activeRouteRef.current;
      if (!activeRoute) return;
      sendAnalyticsPayload(
        {
          eventName: "page_leave",
          featureArea: inferFeatureAreaFromRoute(activeRoute.route),
          route: activeRoute.route,
          durationMs: performance.now() - activeRoute.startedAt,
          metadata: { unload: true },
        },
        true
      );
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [userId]);
}
