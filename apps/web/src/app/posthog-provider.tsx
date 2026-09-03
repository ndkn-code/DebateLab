"use client";

import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";

type PostHogProviderProps = {
  children: React.ReactNode;
  enabled: boolean;
};

function hasLoadedPostHog() {
  return Boolean((posthog as typeof posthog & { __loaded?: boolean }).__loaded);
}

export function sanitizeGuardianConsentUrl(value: string): string;
export function sanitizeGuardianConsentUrl(value: unknown): unknown;
export function sanitizeGuardianConsentUrl(value: unknown): unknown {
  if (typeof value !== "string") return value;
  const marker = value.match(/\/((?:en|vi)\/)?guardian-consent\/[^/?#]+/i);
  if (!marker) return value;
  return value.replace(marker[0], `/${marker[1] ?? ""}guardian-consent/:token`).split("?")[0].split("#")[0];
}

export function sanitizePostHogEvent(event: Record<string, unknown>) {
  const properties = event.properties;
  if (!properties || typeof properties !== "object") return event;
  const entries = Object.entries(properties as Record<string, unknown>);
  const consentEvent = entries.some(
    ([, value]) =>
      typeof value === "string" && /\/guardian-consent\/(?:[^/?#]+|:token)/i.test(value),
  );
  const sanitized = Object.fromEntries(entries.flatMap(([key, value]) => {
    const normalizedKey = key.toLowerCase();
    if (
      consentEvent &&
      (normalizedKey.includes("referrer") ||
        normalizedKey.includes("query") ||
        normalizedKey.includes("search") ||
        normalizedKey.includes("hash") ||
        normalizedKey.includes("token"))
    ) {
      return [];
    }
    return [[
      key,
      typeof value === "string" &&
      (normalizedKey.includes("url") || normalizedKey.includes("referrer"))
        ? sanitizeGuardianConsentUrl(value)
        : value,
    ]];
  }));
  return { ...event, properties: sanitized };
}

export function PostHogProvider({
  children,
  enabled,
}: PostHogProviderProps) {
  useEffect(() => {
    if (!enabled) {
      if (hasLoadedPostHog()) {
        posthog.opt_out_capturing();
        posthog.reset();
      }
      return;
    }

    if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_POSTHOG_KEY) {
      if (!hasLoadedPostHog()) {
        posthog.init(process.env.NEXT_PUBLIC_POSTHOG_KEY, {
          api_host: "/ingest",
          ui_host: "https://us.i.posthog.com",
          capture_pageview: false,
          before_send: (event) =>
            sanitizePostHogEvent(
              event as unknown as Record<string, unknown>,
            ) as unknown as typeof event,
          capture_pageleave: true,
          autocapture: true,
          session_recording: {
            maskAllInputs: false,
            maskInputOptions: { password: true },
          },
        });
      } else {
        posthog.opt_in_capturing();
      }

      posthog.set_config({ persistence: "localStorage+cookie" });
      if (window.location.pathname.includes("/guardian-consent/")) {
        posthog.set_config({ autocapture: false, disable_session_recording: true });
      }
    }
  }, [enabled]);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}

function PageviewTracker({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (enabled && pathname && hasLoadedPostHog()) {
      const isConsentRoute = pathname.includes("/guardian-consent/");
      posthog.set_config({
        autocapture: !isConsentRoute,
        disable_session_recording: isConsentRoute,
      });
      let url = window.origin + sanitizeGuardianConsentUrl(pathname);
      if (searchParams?.toString()) url += "?" + searchParams.toString();
      posthog.capture("$pageview", { $current_url: sanitizeGuardianConsentUrl(url) });
    }
  }, [enabled, pathname, searchParams]);

  return null;
}

export function PostHogPageview({ enabled }: { enabled: boolean }) {
  return (
    <Suspense fallback={null}>
      <PageviewTracker enabled={enabled} />
    </Suspense>
  );
}
