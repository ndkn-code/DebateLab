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
    }
  }, [enabled]);

  return <PHProvider client={posthog}>{children}</PHProvider>;
}

function PageviewTracker({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (enabled && pathname && hasLoadedPostHog()) {
      let url = window.origin + pathname;
      if (searchParams?.toString()) url += "?" + searchParams.toString();
      posthog.capture("$pageview", { $current_url: url });
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
