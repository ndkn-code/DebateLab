"use client";

import { useEffect } from "react";
import { captureHandledError } from "@/lib/observability/faro-client";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin error:", error);
    captureHandledError(
      error,
      { digest: error.digest, featureArea: "admin_dashboard" },
      { type: "react_error_boundary" }
    );
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center px-5 py-10">
      <div className="text-center space-y-4">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-control bg-error-container text-error">
          <span aria-hidden="true">!</span>
        </div>
        <h2 className="text-xl font-medium text-on-surface">Something went wrong</h2>
        <p className="text-sm text-on-surface-variant max-w-md">{error.message}</p>
        <button
          onClick={reset}
          className="h-8 rounded-control bg-primary px-3 text-sm font-medium text-on-primary transition hover:bg-primary-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
