"use client";

import { useEffect } from "react";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";

export default function CourseEditorError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Course editor error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 space-y-4">
      <Link
        href="/dashboard/admin/courses"
        className="flex items-center gap-1 text-sm text-on-surface-variant hover:text-on-surface"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Courses
      </Link>
      <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/10 p-8 text-center space-y-4">
        <h2 className="text-xl font-bold text-on-surface">Error loading course</h2>
        <p className="text-sm text-on-surface-variant">{error.message}</p>
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
