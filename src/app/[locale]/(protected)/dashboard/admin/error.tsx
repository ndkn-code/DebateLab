"use client";

import { useEffect } from "react";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Admin error:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="text-center space-y-4">
        <h2 className="text-xl font-bold text-on-surface">Something went wrong</h2>
        <p className="text-sm text-on-surface-variant max-w-md">{error.message}</p>
        <button
          onClick={reset}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-on-primary hover:bg-primary/90"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
