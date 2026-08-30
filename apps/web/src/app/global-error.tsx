"use client";

import { useEffect } from "react";

import {
  captureHandledError,
  initializeThinkfyFaro,
} from "@/lib/observability/faro-client";
import { hasBrowserAnalyticsConsent } from "@/lib/analytics-consent";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (!hasBrowserAnalyticsConsent()) return;

    initializeThinkfyFaro();
    captureHandledError(
      error,
      { digest: error.digest, featureArea: "root_layout" },
      { fatal: true, type: "react_error_boundary" }
    );
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="grid min-h-dvh place-items-center bg-background p-6 text-foreground">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-semibold">Something went wrong</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Please try again. If the problem continues, contact support.
            </p>
            <button
              type="button"
              onClick={reset}
              className="mt-5 rounded-lg bg-primary px-4 py-2 text-primary-foreground"
            >
              Try again
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
